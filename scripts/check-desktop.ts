// Run against an app launched with isolated SCREENREC_DATA_DIR/SCREENREC_PROJECTS_DIR.
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Job, Project, ProjectSummary } from "@/shared/types.js";
import { duration } from "@/shared/timeline.js";

assert(
  process.env.SCREENREC_DATA_DIR,
  "Set SCREENREC_DATA_DIR to the isolated running desktop service.",
);
const video = path.resolve(process.argv[2] ?? "");
assert(process.argv[2] && (await fs.stat(video)).isFile(), "Pass a synthetic test MP4 path.");
const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-desktop-check-"));
const env = Object.fromEntries(
  Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
);
const created: string[] = [];
const resources = path.resolve(process.env.SCREENREC_TEST_RESOURCES || "resources");
let client: Client;
async function connect() {
  const next = new Client({ name: "desktop-acceptance-check", version: "1.0.0" });
  await next.connect(
    new StdioClientTransport({
      command: path.join(resources, "bin/node"),
      args: [path.join(resources, "mcp.mjs")],
      env,
      stderr: "inherit",
    }),
  );
  return next;
}
async function call<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await client.callTool({ name: name.replace(/[./]/g, "_"), arguments: args });
  assert(!response.isError, `${name}: ${JSON.stringify(response.content)}`);
  return (response.structuredContent as { result: T }).result;
}
async function finish(id: string) {
  for (let n = 0; n < 400; n++) {
    const job = await call<Job>("jobs.get", { jobId: id });
    if (job.status === "completed") return job;
    assert(!["failed", "cancelled"].includes(job.status), JSON.stringify(job));
    await delay(300);
  }
  throw new Error("Desktop job timed out");
}

client = await connect();
try {
  const tools = await client.listTools();
  assert(tools.tools.length >= 40);
  const capabilities = await call<{ nativeAvailable: boolean }>("app.capabilities");
  assert(capabilities.nativeAvailable, "The native desktop service must be running.");
  const baseline = await call<ProjectSummary[]>("project.list");
  const requestId = randomUUID();
  let first = await call<Project>("project.create", { name: "MCP acceptance draft A", requestId });
  created.push(first.id);
  assert.equal(
    (await call<Project>("project.create", { name: "MCP acceptance draft A", requestId })).id,
    first.id,
  );
  const second = await call<Project>("project.create", { name: "MCP acceptance draft B" });
  created.push(second.id);
  first = await call("project.rename", {
    projectId: first.id,
    expectedRevision: first.revision,
    name: "MCP renamed draft",
  });
  const conflict = await client.callTool({
    name: "project_rename",
    arguments: { projectId: first.id, expectedRevision: 0, name: "Must not apply" },
  });
  assert(conflict.isError, "Stale revision must be rejected.");
  assert.equal((await call<Project>("project.open", { projectId: second.id })).name, second.name);
  await call("project.save", { projectId: first.id });
  await client.close();
  client = await connect();
  assert.equal((await call<Project>("project.open", { projectId: first.id })).name, first.name);

  let project = await call<Project>("project.import", {
    path: video,
    name: "MCP native integration",
  });
  created.push(project.id);
  const originalDuration = duration(project.edits.segments);
  assert(originalDuration > 2000);
  project = await call("timeline.apply", {
    projectId: project.id,
    expectedRevision: project.revision,
    operations: [
      { type: "cut", startMs: 1000, endMs: 1500 },
      { type: "camera.hide", startMs: 100, endMs: 500, hidden: true },
      {
        type: "overlay.add",
        overlay: {
          kind: "text",
          text: "MCP desktop acceptance",
          startMs: 0,
          endMs: 700,
          x: 0.08,
          y: 0.1,
          width: 0.8,
          fontSize: 40,
          color: "#ffffff",
          animation: "fade",
        },
      },
    ],
  });
  assert.equal(duration(project.edits.segments), originalDuration - 500);
  assert.equal(project.edits.overlays.length, 1);
  project = await call("history.undo", {
    projectId: project.id,
    expectedRevision: project.revision,
  });
  assert.equal(duration(project.edits.segments), originalDuration);
  assert.equal(project.edits.overlays.length, 0);
  project = await call("history.redo", {
    projectId: project.id,
    expectedRevision: project.revision,
  });
  project = await call("timeline.apply", {
    projectId: project.id,
    expectedRevision: project.revision,
    operations: [
      { type: "speed", startMs: 0, endMs: 1000, speed: 2 },
      {
        type: "canvas.update",
        settings: {
          aspectRatio: "9:16",
          background: "wallpaper",
          wallpaper: "aurora",
          blur: 12,
          padding: 0.06,
          radius: 0.025,
          shadow: 0.35,
          frame: "browser",
          title: "MCP portrait acceptance",
        },
      },
      {
        type: "zoom.add",
        zoom: {
          startMs: 100,
          endMs: 700,
          scale: 1.8,
          x: 0.5,
          y: 0.5,
          motion: "gentle",
          followCursor: true,
        },
      },
      {
        type: "transcript.update",
        segments: [{ id: "acceptance-cue", startMs: 0, endMs: 500, text: "Before text edit" }],
      },
    ],
  });
  assert.equal(duration(project.edits.segments), originalDuration - 1000);
  const cue = project.transcript[0]!;
  const zoomId = project.edits.zooms[0]!.id;
  project = await call("timeline.apply", {
    projectId: project.id,
    expectedRevision: project.revision,
    operations: [
      { type: "transcript.text", id: cue.id, text: "Timing stays intact" },
      {
        type: "zoom.update",
        id: zoomId,
        zoom: { startMs: 200, endMs: 800, scale: 2.2, motion: "snappy" },
      },
    ],
  });
  assert.equal(project.transcript[0]!.startMs, cue.startMs);
  assert.equal(project.transcript[0]!.endMs, cue.endMs);
  assert.equal(project.edits.zooms[0]!.id, zoomId);
  assert.equal(project.edits.zooms[0]!.scale, 2.2);
  await call("preview.load", { projectId: project.id });
  await call("preview.draft", {
    projectId: project.id,
    expectedRevision: project.revision,
    operations: [{ type: "canvas.update", settings: { background: "color", color: "#d82040" } }],
  });
  const afterDraft = await call<Project>("project.open", { projectId: project.id });
  assert.equal(afterDraft.revision, project.revision);
  assert.deepEqual(
    afterDraft.edits,
    project.edits,
    "Transient preview must not change the saved edit state.",
  );
  await call("preview.load", { projectId: project.id });
  await call("preview.seek", { timeMs: 500 });
  const frame = await client.callTool({
    name: "preview_frame",
    arguments: { projectId: project.id, timeMs: 500 },
  });
  assert(
    !frame.isError && Array.isArray(frame.content) && frame.content.some((c) => c.type === "image"),
  );
  const frameResult = frame.structuredContent as { result: { path: string } };
  const png = await fs.readFile(frameResult.result.path);
  assert(
    Math.abs(png.readUInt32BE(16) / png.readUInt32BE(20) - 9 / 16) < 0.005,
    "Preview must retain the portrait canvas ratio.",
  );
  const exportPath = path.join(artifacts, "mcp-export.mp4");
  const exportRequest = { projectId: project.id, path: exportPath, requestId: randomUUID() };
  const job = await call<Job>("export.start", exportRequest);
  assert.equal((await call<Job>("export.start", exportRequest)).id, job.id);
  await client.close();
  client = await connect();
  await finish(job.id);
  assert((await fs.stat(exportPath)).size > 1000);
  const inspected = await call<Project>("project.import", {
    path: exportPath,
    name: "MCP exported portrait check",
  });
  created.push(inspected.id);
  assert.equal(inspected.source!.width, 1080);
  assert.equal(inspected.source!.height, 1920);
  assert(
    Math.abs(inspected.source!.durationMs - duration(project.edits.segments)) < 80,
    "Rendered duration must follow cuts and speed.",
  );
  await call("project.delete", { projectId: project.id, expectedRevision: project.revision });
  created.splice(created.indexOf(project.id), 1);
  assert((await fs.stat(exportPath)).size > 1000, "Deleting project must retain external MP4.");
  assert.equal(
    (await call<Project>("project.open", { projectId: second.id })).revision,
    second.revision,
  );
  const remaining = await call<ProjectSummary[]>("project.list");
  assert(
    baseline.every((p) => remaining.some((q) => q.id === p.id)),
    "Existing projects must survive.",
  );
  console.log(
    `Desktop MCP checks passed: ${tools.tools.length} tools, schema/revisions, independent projects, idempotency, reconnect, speed/cuts, editable zoom, transcript text timing, portrait preview/export, undo/redo and Trash with output preservation.`,
  );
  console.log(`Artifacts: ${artifacts}`);
} finally {
  for (const projectId of created) {
    for (const job of await call<Job[]>("jobs.list", { projectId }).catch(() => []))
      if (["queued", "running"].includes(job.status))
        await call("jobs.cancel", { jobId: job.id }).catch(() => {});
    await call("project.delete", { projectId }).catch((error) =>
      console.error(`Test cleanup: ${String(error)}`),
    );
  }
  await client.close();
}
