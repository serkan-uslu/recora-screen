import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { projectSchema } from "@/server/contracts/validation.js";
import { createMcpServer } from "@/server/mcp.js";
import { ApplicationService } from "@/server/services/ApplicationService.js";
import type { NativeCall } from "@/server/services/types.js";
import type { Project } from "@/shared/types.js";

const jobSchema = z
  .object({
    id: z.string(),
    status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
    result: z.unknown().optional(),
    error: z.string().optional(),
  })
  .passthrough();

function toolResult(value: unknown) {
  const result = CallToolResultSchema.parse(value);
  assert.equal(result.isError, undefined);
  assert(result.structuredContent && "result" in result.structuredContent);
  return result;
}

function toolValue(value: unknown) {
  const result = toolResult(value);
  const structured = result.structuredContent;
  assert(structured);
  return structured.result;
}

test("MCP media, timeline, history, preview and export share the desktop project contract", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "recora-mcp-editor-"));
  let rendered: Project | undefined;
  let exported: Project | undefined;
  let metricsReset = false;
  const native: NativeCall = async (method, params = {}) => {
    if (method === "preview.load")
      return { timeMs: 0, playing: false, itemId: "test-preview", geometry: { items: [] } };
    if (method === "preview.frame") {
      rendered = projectSchema.parse(params.project);
      await fs.writeFile(String(params.path), "png fixture");
      return { path: params.path };
    }
    if (method === "export.start") {
      exported = projectSchema.parse(params.project);
      await fs.writeFile(String(params.path), "export fixture");
      return {};
    }
    if (method === "export.status") return { status: "completed", progress: 1 };
    if (method === "export.cancel") return {};
    if (method === "preview.metrics") {
      metricsReset = params.reset === true;
      return { renderMs: [4] };
    }
    throw new Error(`Unexpected native call: ${method}`);
  };
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native,
  });
  await service.initialize();
  const created = await service.store.create("MCP editor chain");
  await fs.writeFile(path.join(service.store.dir(created.id), "media/screen.mov"), "screen");
  const project = await service.store.mutate(
    created.id,
    created.revision,
    (current) => {
      current.source = {
        durationMs: 10000,
        width: 1920,
        height: 1080,
        fps: 30,
        screen: "media/screen.mov",
      };
      current.status = "ready";
      current.edits.segments = [{ startMs: 0, endMs: 10000 }];
    },
    false,
  );
  const image = path.join(root, "title.png");
  await fs.writeFile(image, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]));
  const output = path.join(root, "result.mp4");
  const server = createMcpServer((method, params) => service.command(method, params));
  const client = new Client({ name: "editor-e2e", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  });

  const tools = await client.listTools();
  const assetSchema = tools.tools.find((tool) => tool.name === "asset_import")?.inputSchema;
  assert(assetSchema && "required" in assetSchema);
  assert(assetSchema.required?.includes("expectedRevision"));
  const metrics = tools.tools.find((tool) => tool.name === "preview_metrics");
  assert.equal(metrics?.annotations?.readOnlyHint, false);
  assert.equal(metrics?.annotations?.idempotentHint, false);
  assert.deepEqual(
    toolValue(await client.callTool({ name: "preview_metrics", arguments: { reset: true } })),
    { renderMs: [4] },
  );
  assert.equal(metricsReset, true);

  const imported = projectSchema.parse(
    toolValue(
      await client.callTool({
        name: "asset_import",
        arguments: {
          projectId: project.id,
          expectedRevision: project.revision,
          kind: "image",
          path: image,
        },
      }),
    ),
  );
  const asset = imported.assets[0]!;
  const staleImport = CallToolResultSchema.parse(
    await client.callTool({
      name: "asset_import",
      arguments: {
        projectId: project.id,
        expectedRevision: project.revision,
        kind: "image",
        path: image,
      },
    }),
  );
  assert.equal(staleImport.isError, true);
  assert.equal(
    z.object({ error: z.object({ code: z.string() }) }).parse(staleImport.structuredContent).error
      .code,
    "REVISION_CONFLICT",
  );
  const edited = projectSchema.parse(
    toolValue(
      await client.callTool({
        name: "timeline_apply",
        arguments: {
          projectId: project.id,
          expectedRevision: imported.revision,
          operations: [
            { type: "speed", startMs: 0, endMs: 4000, speed: 2 },
            {
              type: "overlay.add",
              overlay: {
                kind: "text",
                text: "MCP title",
                startMs: 3000,
                endMs: 5000,
                x: 0.1,
                y: 0.1,
                width: 0.5,
                fontSize: 32,
                color: "#ffffff",
                animation: "fade",
              },
            },
            { type: "clip.insert", assetId: asset.id, atMs: 2500 },
          ],
        },
      }),
    ),
  );
  assert.deepEqual(
    edited.edits.segments.map(({ startMs, endMs, speed, assetId }) => ({
      startMs,
      endMs,
      ...(speed ? { speed } : {}),
      ...(assetId ? { assetId } : {}),
    })),
    [
      { startMs: 0, endMs: 4000, speed: 2 },
      { startMs: 4000, endMs: 4500 },
      { startMs: 0, endMs: 3000, assetId: asset.id },
      { startMs: 4500, endMs: 10000 },
    ],
  );
  assert.deepEqual(
    { startMs: edited.edits.overlays[0]!.startMs, endMs: edited.edits.overlays[0]!.endMs },
    { startMs: 5000, endMs: 7000 },
    "later operations use the output timeline produced by earlier operations in the batch",
  );
  assert.deepEqual(await service.command("project.open", { projectId: project.id }), edited);

  const undoneEdit = projectSchema.parse(
    toolValue(
      await client.callTool({
        name: "history_undo",
        arguments: { projectId: project.id, expectedRevision: edited.revision },
      }),
    ),
  );
  assert.deepEqual(undoneEdit.edits, imported.edits);
  assert.deepEqual(
    undoneEdit.assets,
    imported.assets,
    "undoing the edit keeps the prior asset import",
  );
  const undoneAsset = projectSchema.parse(
    toolValue(
      await client.callTool({
        name: "history_undo",
        arguments: { projectId: project.id, expectedRevision: undoneEdit.revision },
      }),
    ),
  );
  assert.deepEqual(undoneAsset.assets, project.assets, "the asset import is its own undo step");
  const redoneAsset = projectSchema.parse(
    toolValue(
      await client.callTool({
        name: "history_redo",
        arguments: { projectId: project.id, expectedRevision: undoneAsset.revision },
      }),
    ),
  );
  assert.deepEqual(redoneAsset.assets, imported.assets);
  const redone = projectSchema.parse(
    toolValue(
      await client.callTool({
        name: "history_redo",
        arguments: { projectId: project.id, expectedRevision: redoneAsset.revision },
      }),
    ),
  );
  assert.deepEqual(redone.edits, edited.edits);

  toolValue(await client.callTool({ name: "preview_load", arguments: { projectId: project.id } }));
  const frame = toolResult(
    await client.callTool({
      name: "preview_frame",
      arguments: { projectId: project.id, timeMs: 3500 },
    }),
  );
  assert(frame.content.some((item) => item.type === "image" && item.data.length > 0));
  assert.deepEqual(rendered, redone);

  const exportJob = jobSchema.parse(
    toolValue(
      await client.callTool({
        name: "export_start",
        arguments: { projectId: project.id, path: output, quality: "1080" },
      }),
    ),
  );
  let completed: z.infer<typeof jobSchema> | undefined;
  for (let attempt = 0; attempt < 100; attempt++) {
    completed = jobSchema.parse(
      toolValue(await client.callTool({ name: "jobs_get", arguments: { jobId: exportJob.id } })),
    );
    if (!["queued", "running"].includes(completed.status)) break;
    await delay(10);
  }
  assert.equal(completed?.status, "completed", completed?.error);
  assert.equal(
    z.object({ revision: z.number() }).parse(completed?.result).revision,
    redone.revision,
  );
  assert.deepEqual(exported, redone);
  assert.equal(await fs.readFile(output, "utf8"), "export fixture");
});
