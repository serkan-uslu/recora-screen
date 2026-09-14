// Run only after the user has authorized the desktop app's camera/microphone permissions.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { AppClient } from "@/server/infrastructure/rpc.js";
import type { AppCapabilities, Project, Job } from "@/shared/types.js";

assert(process.env.SCREENREC_DATA_DIR, "Set SCREENREC_DATA_DIR to the isolated desktop service.");
const client = new AppClient(path.join(process.env.SCREENREC_DATA_DIR, "service.sock"));
const native = path.resolve("native/build/native-check");
const artifacts = path.resolve(".cache/acceptance", `camera-${randomUUID()}`);
await fs.mkdir(artifacts, { recursive: true });
const pattern = spawn(native, ["--pattern"], { stdio: "ignore" });
let recording = false;
let project: Project | undefined;
const inspect = (file: string) =>
  JSON.parse(
    execFileSync(native, ["--rpc"], {
      input:
        JSON.stringify({ id: "inspect", method: "media.inspect", params: { path: file } }) + "\n",
      encoding: "utf8",
    }),
  ).result;
async function finish(id: string) {
  for (let n = 0; n < 200; n++) {
    const job: Job = await client.call("jobs.get", { jobId: id });
    if (job.status === "completed") return;
    assert(!["failed", "cancelled"].includes(job.status), JSON.stringify(job));
    await delay(200);
  }
  throw new Error("Camera fixture export timed out");
}
try {
  await client.connect(false);
  await delay(600);
  const caps: AppCapabilities = await client.call("app.capabilities");
  assert.equal(caps.permissions.camera, "authorized");
  assert.equal(caps.permissions.microphone, "authorized");
  const camera = caps.cameras.find(
    (d) => /FaceTime|built.?in/i.test(d.name) && !/iphone|continuity/i.test(d.name),
  );
  const microphone = caps.microphones.find((d) => /MacBook|built.?in/i.test(d.name));
  const source = caps.sources.find(
    (d) => d.kind === "window" && d.name.includes("Screen Recorder Capture Test"),
  );
  assert(
    camera && microphone && source,
    "Built-in camera, microphone and synthetic pattern window required.",
  );
  project = await client.call("project.create", { name: "Camera acceptance fixture" });
  await client.call("recording.start", {
    projectId: project!.id,
    settings: {
      sourceId: source.id,
      sourceKind: "window",
      cameraId: camera.id,
      microphoneId: microphone.id,
      systemAudio: true,
      cameraShape: "circle",
      width: 1280,
      height: 720,
      fps: 30,
    },
  });
  recording = true;
  await delay(1200);
  assert((await client.call("recording.status")).cameraRunning, "Camera session did not start.");
  const hidden = await client.call("recording.camera", { visible: false });
  assert.equal(hidden.cameraVisible, false);
  assert.equal(hidden.cameraEnabled, true);
  assert(hidden.cameraRunning, "Hiding the preview stopped the camera session.");
  await delay(600);
  await client.call("recording.camera", { visible: true });
  const off = await client.call("recording.camera", { enabled: false });
  assert.equal(off.cameraEnabled, false);
  assert.equal(off.cameraRunning, false, "Camera session remained active after enabled=false.");
  await delay(1200);
  await client.call("recording.camera", { enabled: true });
  await delay(1000);
  assert((await client.call("recording.status")).cameraRunning, "Camera session did not reopen.");
  const paused = await client.call("recording.pause", { projectId: project!.id });
  await delay(350);
  const stillPaused = await client.call("recording.status");
  assert(Math.abs(paused.durationMs - stillPaused.durationMs) < 10);
  await client.call("recording.resume", { projectId: project!.id });
  await delay(500);
  project = await client.call("recording.stop", { projectId: project!.id });
  recording = false;
  assert.equal(
    (await client.call("recording.status")).cameraRunning,
    false,
    "Camera session remained active after stop.",
  );
  assert(project!.source?.camera && project!.source.microphone && project!.source.systemAudio);
  const ranges = project!.source.cameraActiveRanges!;
  assert.equal(ranges.length, 2);
  assert(ranges[1].startMs - ranges[0].endMs >= 1000);
  const listed = await client.call("project.list");
  const directory = listed.find((p: { id: string; path: string }) => p.id === project!.id).path;
  const projectDir = directory.endsWith("project.json") ? path.dirname(directory) : directory;
  const media = {
    screen: inspect(path.join(projectDir, project!.source.screen)),
    camera: inspect(path.join(projectDir, project!.source.camera)),
  };
  assert(Math.abs(media.screen.durationMs - project!.source.durationMs) < 100);
  assert(Math.abs(media.camera.durationMs - project!.source.durationMs) < 150);
  const activeTime = ranges[0].startMs + Math.min(700, (ranges[0].endMs - ranges[0].startMs) / 2),
    gapTime = (ranges[0].endMs + ranges[1].startMs) / 2;
  const withCamera = await client.call("preview.frame", {
    projectId: project!.id,
    timeMs: activeTime,
  });
  const gap = await client.call("preview.frame", { projectId: project!.id, timeMs: gapTime });
  project = await client.call("timeline.apply", {
    projectId: project!.id,
    expectedRevision: project!.revision,
    operations: [{ type: "camera.update", settings: { visible: false } }],
  });
  const withoutCamera = await client.call("preview.frame", {
    projectId: project!.id,
    timeMs: activeTime,
  });
  const gapWithoutCamera = await client.call("preview.frame", {
    projectId: project!.id,
    timeMs: gapTime,
  });
  assert(
    !(await fs.readFile(withCamera.path)).equals(await fs.readFile(withoutCamera.path)),
    "Active source interval did not render the camera.",
  );
  assert(
    (await fs.readFile(gap.path)).equals(await fs.readFile(gapWithoutCamera.path)),
    "Hardware-off gap rendered a frozen face.",
  );
  project = await client.call("timeline.apply", {
    projectId: project!.id,
    expectedRevision: project!.revision,
    operations: [{ type: "camera.update", settings: { visible: true } }],
  });
  const output = path.join(artifacts, "camera-acceptance.mp4");
  const job: Job = await client.call("export.start", {
    projectId: project!.id,
    path: output,
    width: 1920,
    height: 1080,
  });
  await finish(job.id);
  await client.call("preview.load", { projectId: project!.id });
  await client.call("preview.seek", { timeMs: activeTime });
  const report = {
    projectId: project!.id,
    projectDir,
    output,
    durationMs: project!.source!.durationMs,
    cameraActiveRanges: ranges,
    media,
    checks: [
      "AVCaptureSession start/stop/reopen",
      "hide preserves capture",
      "pause/resume",
      "separate tracks",
      "two source active intervals",
      "camera render when active",
      "no frozen camera in gap",
      "1080p export",
    ],
  };
  await fs.writeFile(path.join(artifacts, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (recording && project)
    await client
      .call("recording.stop", { projectId: project.id })
      .catch((error) => console.error("Recording cleanup failed:", error));
  client.close();
  if (!pattern.killed) pattern.kill("SIGTERM");
  if (project) console.log(`Preserved Camera acceptance fixture: ${project.id}`);
}
