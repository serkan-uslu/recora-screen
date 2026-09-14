// Opt-in recording diagnostic. Never requests permissions, launches an app, or edits existing projects.
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs, promisify } from "node:util";
import { execFile, spawn } from "node:child_process";
import { AppClient } from "@/server/rpc.js";
import type {
  AppCapabilities,
  CursorEvent,
  Project,
  ProjectSummary,
  RecordingStatus,
} from "@/shared/types.js";

function cursorReport(events: CursorEvent[], durationMs: number) {
  assert(events.length > 0, "No pointer metadata was recorded.");
  let last = -1,
    maxGapMs = 0;
  for (const event of events) {
    assert(
      Number.isFinite(event.tMs) && event.tMs >= last && event.tMs <= durationMs + 1,
      "Cursor time is invalid, unordered, or beyond the media end.",
    );
    assert(
      Number.isFinite(event.x) &&
        Number.isFinite(event.y) &&
        event.x >= 0 &&
        event.x <= 1 &&
        event.y >= 0 &&
        event.y <= 1,
      "Cursor geometry is invalid.",
    );
    if (last >= 0) maxGapMs = Math.max(maxGapMs, event.tMs - last);
    last = event.tMs;
  }
  return {
    events: events.length,
    firstMs: events[0]!.tMs,
    lastMs: last,
    maxGapMs,
    clicks: events.filter((event) => event.kind === "click").length,
    drags: events.filter((event) => event.kind === "drag").length,
    typing: events.filter((event) => event.kind === "typing").length,
  };
}
function audioInspection(output: string) {
  const durationMs = Number(/estimated duration:\s*([0-9.]+) sec/.exec(output)?.[1]) * 1000;
  assert(
    Number.isFinite(durationMs) && durationMs > 0,
    "afinfo did not report a valid audio duration.",
  );
  return {
    durationMs,
    estimated: true,
    hasAudio: true,
    sampleRateHz: Number(/([0-9.]+) Hz/.exec(output)?.[1]),
    channels: Number(/(\d+) ch,/.exec(output)?.[1]),
    tool: "macOS afinfo",
    note: "Audio frame duration; not an A/V presentation-offset or lip-sync measurement.",
  };
}
async function inspect(
  native: string,
  file: string,
  audio = false,
): Promise<Record<string, unknown>> {
  if (audio)
    return audioInspection(
      (
        await promisify(execFile)("/usr/bin/afinfo", [file], {
          env: { ...process.env, LC_ALL: "C" },
        })
      ).stdout,
    );
  return new Promise((resolve, reject) => {
    const child = spawn(native, ["--rpc"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        assert(code === 0, stderr);
        const reply = JSON.parse(stdout.trim());
        assert(!reply.error, JSON.stringify(reply.error));
        resolve(reply.result);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(
      JSON.stringify({ id: "inspect", method: "media.inspect", params: { path: file } }) + "\n",
    );
  });
}
const { values } = parseArgs({
  options: {
    capture: { type: "boolean" },
    "self-check": { type: "boolean" },
    seconds: { type: "string", default: "10" },
    source: { type: "string" },
    camera: { type: "string" },
    microphone: { type: "string" },
    "system-audio": { type: "boolean" },
    "require-input": { type: "boolean" },
    "pause-resume": { type: "boolean" },
  },
});
if (values["self-check"]) {
  assert.deepEqual(
    cursorReport(
      [
        { tMs: 0, x: 0.2, y: 0.3 },
        { tMs: 20, x: 0.2, y: 0.3, kind: "click" },
        { tMs: 21, x: 0.4, y: 0.3, kind: "drag" },
        { tMs: 40, x: 0.4, y: 0.3, kind: "typing" },
      ],
      50,
    ),
    { events: 4, firstMs: 0, lastMs: 40, maxGapMs: 20, clicks: 1, drags: 1, typing: 1 },
  );
  assert.throws(() => cursorReport([], 50));
  assert.throws(() => cursorReport([{ tMs: 60, x: 0, y: 0 }], 50));
  assert.throws(() =>
    cursorReport(
      [
        { tMs: 20, x: 0, y: 0 },
        { tMs: 10, x: 0, y: 0 },
      ],
      50,
    ),
  );
  assert.equal(
    audioInspection("Data format: 2 ch, 48000 Hz, aac\nestimated duration: 20.053333 sec")
      .durationMs,
    20053.333,
  );
  assert.throws(() => audioInspection("Not an audio track"));
  console.log("Interaction report self-check passed. No app connection or recording.");
} else if (!values.capture) {
  console.log(
    "Usage: npx tsx scripts/check-interactions.ts --capture [--seconds 10] [--source ID] [--pause-resume] [--require-input] [--system-audio] [--camera ID] [--microphone ID]\nOpen the signed desktop app first. Default: available display, 1080p/30, no camera/microphone/system audio. Existing permission is required; none is requested. Two clearly named QA projects and a JSON report are preserved. Use --self-check for a non-recording check.",
  );
} else {
  const seconds = Number(values.seconds);
  assert(
    Number.isFinite(seconds) && seconds >= 2 && seconds <= 60,
    "--seconds must be between 2 and 60.",
  );
  const client = new AppClient(
    process.env.SCREENREC_DATA_DIR
      ? path.join(process.env.SCREENREC_DATA_DIR, "service.sock")
      : undefined,
  );
  const artifactDir = path.resolve(".cache/acceptance", `interactions-${randomUUID()}`);
  let project: Project | undefined, other: Project | undefined;
  const snapshots: { wallMs: number; roundTripMs: number; status: RecordingStatus }[] = [];
  const journalPath = path.join(artifactDir, "journal.jsonl");
  async function journal(event: Record<string, unknown>) {
    await fs.mkdir(artifactDir, { recursive: true });
    await fs.appendFile(
      journalPath,
      JSON.stringify({ date: new Date().toISOString(), ...event }) + "\n",
    );
  }
  const abort = new AbortController();
  const onSignal = () => abort.abort();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    await journal({ action: "connect", options: values });
    await client.connect(false);
    const caps: AppCapabilities = await client.call("app.capabilities");
    assert(
      caps.nativeAvailable && caps.permissions.screen,
      "Open the signed desktop app with existing screen permission first.",
    );
    assert(
      !(await client.call("recording.status")).active,
      "A recording is already active; the diagnostic will not interfere.",
    );
    const source = values.source
      ? caps.sources.find((item) => item.id === values.source)
      : caps.sources.find((item) => item.kind === "display");
    assert(source, "No requested capture source is available.");
    if (values.camera)
      assert(
        caps.permissions.camera === "authorized" &&
          caps.cameras.some((item) => item.id === values.camera),
        "Requested camera is unavailable or permission is missing.",
      );
    if (values.microphone)
      assert(
        caps.permissions.microphone === "authorized" &&
          caps.microphones.some((item) => item.id === values.microphone),
        "Requested microphone is unavailable or permission is missing.",
      );
    if (values["require-input"])
      assert(
        caps.permissions.input,
        "Input Monitoring permission must already be enabled for this build.",
      );
    await fs.mkdir(artifactDir, { recursive: true });
    const stamp = new Date().toISOString();
    project = await client.call("project.create", {
      name: `QA input capture ${stamp}`,
      requestId: randomUUID(),
    });
    other = await client.call("project.create", {
      name: `QA concurrent draft ${stamp}`,
      requestId: randomUUID(),
    });
    const recordingProject = project!,
      otherProject = other!;
    const settings = {
      sourceId: source.id,
      sourceKind: source.kind,
      cameraId: values.camera,
      microphoneId: values.microphone,
      systemAudio: Boolean(values["system-audio"]),
      cameraShape: "circle",
      width: 1920,
      height: 1080,
      fps: 30,
    };
    await journal({
      action: "projects.created",
      projectId: recordingProject.id,
      otherProjectId: otherProject.id,
      settings,
    });
    console.log(
      `Recording ${source.name} for ${seconds}s. Move inside the source immediately, click quickly, drag, open a menu, and type in the captured app. This script does not generate input.`,
    );
    const started = performance.now();
    await journal({ action: "recording.start.requested" });
    const startStatus = await client.call("recording.start", {
      projectId: recordingProject.id,
      settings,
      requestId: randomUUID(),
    });
    await journal({ action: "recording.start.completed", status: startStatus });
    const recordingStarted = performance.now();
    let paused = false,
      edited = false,
      concurrentSaveMs: number | undefined;
    while (performance.now() - recordingStarted < seconds * 1000) {
      abort.signal.throwIfAborted();
      const before = performance.now();
      const status: RecordingStatus = await client.call("recording.status");
      const snapshot = {
        wallMs: performance.now() - recordingStarted,
        roundTripMs: performance.now() - before,
        status,
      };
      snapshots.push(snapshot);
      await journal({ action: "recording.status", ...snapshot });
      assert.equal(status.projectId, recordingProject.id, "Active recording changed unexpectedly.");
      assert(
        status.active && !status.error,
        status.error ??
          `Recording ended before the diagnostic requested stop (phase: ${status.phase ?? "unknown"}). An external UI, shortcut, or client may have stopped it; inspect journal.jsonl.`,
      );
      if (!edited && performance.now() - recordingStarted > 1000) {
        const editStart = performance.now();
        other = await client.call("project.rename", {
          projectId: otherProject.id,
          expectedRevision: otherProject.revision,
          name: `${otherProject.name} — saved during recording`,
          requestId: randomUUID(),
        });
        await client.call("project.save", { projectId: otherProject.id });
        concurrentSaveMs = performance.now() - editStart;
        edited = true;
        await journal({
          action: "concurrent-project.saved",
          projectId: otherProject.id,
          elapsedMs: concurrentSaveMs,
        });
        await assert.rejects(
          client.call("project.rename", {
            projectId: recordingProject.id,
            expectedRevision: recordingProject.revision + 1,
            name: "Must remain protected",
            requestId: randomUUID(),
          }),
          /busy/i,
        );
      }
      if (
        values["pause-resume"] &&
        !paused &&
        performance.now() - recordingStarted > seconds * 500
      ) {
        await journal({ action: "recording.pause.requested" });
        const beforePause: RecordingStatus = await client.call("recording.pause", {
          projectId: recordingProject.id,
        });
        await journal({ action: "recording.pause.completed", status: beforePause });
        await delay(400, undefined, { signal: abort.signal });
        const duringPause: RecordingStatus = await client.call("recording.status");
        await journal({ action: "recording.pause.observed", status: duringPause });
        assert(
          Math.abs(beforePause.durationMs - duringPause.durationMs) < 10,
          "Paused media clock moved.",
        );
        const resumed = await client.call("recording.resume", { projectId: recordingProject.id });
        paused = true;
        await journal({ action: "recording.resume.completed", status: resumed });
      }
      await delay(200, undefined, { signal: abort.signal });
    }
    const stopStart = performance.now();
    await journal({ action: "recording.stop.requested" });
    project = await client.call("recording.stop", {
      projectId: recordingProject.id,
      requestId: randomUUID(),
    });
    const stopMs = performance.now() - stopStart;
    await journal({
      action: "recording.stop.completed",
      projectId: project!.id,
      source: project!.source,
      elapsedMs: stopMs,
    });
    assert(
      project!.source?.screen && project!.source?.cursor,
      "Recording did not return separate screen/cursor tracks.",
    );
    const finalProject = project!,
      media = finalProject.source!;
    const listed: ProjectSummary[] = await client.call("project.list");
    const projectDir = listed.find((item) => item.id === finalProject.id)!.path;
    const events: CursorEvent[] = JSON.parse(
      await fs.readFile(path.join(projectDir, media.cursor!), "utf8"),
    );
    const cursor = cursorReport(events, media.durationMs);
    const checks = {
      firstPointerWithin200ms: cursor.firstMs <= 200,
      monitorPresent: snapshots.some((item) => Boolean(item.status.monitoring)),
      authorizedTapActive: snapshots.some((item) => item.status.monitoring?.input === "active"),
      concurrentSaveCompleted: edited,
    };
    const trackInspection: Record<string, unknown> = {};
    const native = path.resolve("native/build/native-check");
    if (
      await fs.stat(native).then(
        (stat) => stat.isFile(),
        () => false,
      )
    ) {
      for (const [kind, file] of Object.entries({
        screen: media.screen,
        camera: media.camera,
        microphone: media.microphone,
        systemAudio: media.systemAudio,
      })) {
        if (file)
          trackInspection[kind] = await inspect(
            native,
            path.join(projectDir, file),
            kind === "microphone" || kind === "systemAudio",
          );
      }
    }
    const report = {
      date: new Date().toISOString(),
      host: {
        platform: os.platform(),
        release: os.release(),
        cpu: os.cpus()[0]?.model,
        memoryBytes: os.totalmem(),
      },
      projectId: finalProject.id,
      otherProjectId: otherProject.id,
      projectDir,
      settings,
      startupMs: recordingStarted - started,
      stopMs,
      durationMs: media.durationMs,
      concurrentSaveMs,
      cursor,
      checks,
      snapshots,
      trackInspection,
      limits: [
        "RPC round trips are not input-to-render latency.",
        "Track durations do not prove A/V lip-sync accuracy.",
        "Pointer timing assumes the pointer was inside the chosen source at start.",
        "No keyboard text/keycodes are read by this diagnostic.",
        "Additional camera/composition checks exist in scripts/check-camera.ts and native/check.sh; sustained A/V synchronization still requires a dedicated recording.",
      ],
    };
    await fs.writeFile(path.join(artifactDir, "result.json"), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify(
        {
          projectId: finalProject.id,
          projectDir,
          cursor,
          checks,
          concurrentSaveMs,
          report: path.join(artifactDir, "result.json"),
        },
        null,
        2,
      ),
    );
    assert(
      checks.firstPointerWithin200ms,
      "First pointer exceeded 200 ms; inspect source bounds and report.",
    );
    assert(checks.monitorPresent, "This app build did not report actual monitor status.");
    if (values["require-input"])
      assert(
        checks.authorizedTapActive && cursor.clicks > 0 && cursor.typing > 0,
        "No active tap/click/typing evidence. Repeat with deliberate click and typing input.",
      );
  } catch (error) {
    const failure = {
      date: new Date().toISOString(),
      projectId: project?.id,
      otherProjectId: other?.id,
      error:
        error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      snapshots,
      journalPath,
    };
    await fs.mkdir(artifactDir, { recursive: true });
    await fs.writeFile(path.join(artifactDir, "failure.json"), JSON.stringify(failure, null, 2));
    console.error(
      `Diagnostic failed; snapshots preserved at ${path.join(artifactDir, "failure.json")}`,
    );
    throw error;
  } finally {
    if (project) {
      const status: RecordingStatus | undefined = await client
        .call("recording.status")
        .catch(() => undefined);
      await journal({ action: "cleanup.status", status });
      if (status?.active && status.projectId === project.id) {
        await journal({ action: "cleanup.stop.requested", projectId: project.id });
        await client
          .call("recording.stop", { projectId: project.id })
          .then((result) =>
            journal({
              action: "cleanup.stop.completed",
              projectId: result.id,
              source: result.source,
            }),
          )
          .catch((error) =>
            console.error(
              "QA capture finalization failed; reopen this QA project for recovery:",
              error,
            ),
          );
      }
      await client
        .call("project.open", { projectId: project.id })
        .then((result) =>
          fs.writeFile(
            path.join(artifactDir, "final-project.json"),
            JSON.stringify(result, null, 2),
          ),
        )
        .catch((error) => console.error("Could not save final QA project diagnostics:", error));
      console.log(
        `Preserved QA projects: ${project.id}${other ? `, ${other.id}` : ""}. No existing project was changed.`,
      );
    }
    client.close();
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
}
