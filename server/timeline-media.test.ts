import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ApplicationService } from "@/server/services/ApplicationService";
import { timelineMediaSchema } from "@/shared/timelineMedia";

// Sampling itself is tested against decoded media by the native acceptance check.
test("timeline samples resolve immutable source ranges, cache across edits and reject outside media", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-media-test-"));
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method, params = {}) => {
      calls.push({ method, params });
      if (method === "media.filmstrip")
        return [{ timeMs: params.startMs, src: "data:image/jpeg;base64,YQ==" }];
      if (method === "media.waveform") return [0.1, 0, 0.3];
      throw new Error(`Unexpected method ${method}`);
    },
  });
  await service.initialize();
  t.after(async () => {
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  });
  const created = await service.store.create("Media fixture");
  for (const name of ["screen.mov", "mic.wav", "import.mp4"])
    await fs.writeFile(
      path.join(service.store.dir(created.id), "media", name),
      "native decoder fixture",
    );
  let project = await service.store.mutate(
    created.id,
    created.revision,
    (p) => {
      p.source = {
        screen: "media/screen.mov",
        microphone: "media/mic.wav",
        durationMs: 4000,
        width: 640,
        height: 360,
        fps: 30,
      };
      p.status = "ready";
      p.edits.segments = [
        { startMs: 2000, endMs: 4000, speed: 2 },
        { startMs: 0, endMs: 1000 },
      ];
      p.assets = [
        {
          id: "import",
          name: "Imported video",
          path: "media/import.mp4",
          kind: "video",
          durationMs: 3000,
          width: 640,
          height: 360,
        },
      ];
    },
    false,
  );
  const params = { projectId: project.id, startMs: 2000, endMs: 4000, kind: "filmstrip" };
  const first = timelineMediaSchema.parse(await service.command("preview.media", params));
  assert.equal(first.frames[0].timeMs, 2000);
  assert.equal(
    calls[0].params.path,
    await fs.realpath(path.join(service.store.dir(project.id), "media/screen.mov")),
  );
  project = await service.command("timeline.apply", {
    projectId: project.id,
    expectedRevision: project.revision,
    operations: [{ type: "clip.move", index: 1, toIndex: 0 }],
  });
  assert.deepEqual(await service.command("preview.media", params), first);
  assert.equal(calls.length, 1, "Reordering should reuse source samples");
  const waveform = timelineMediaSchema.parse(
    await service.command("preview.media", { ...params, kind: "waveform" }),
  );
  assert.equal(waveform.channels[0].kind, "microphone");
  assert.equal(calls[1].params.startMs, 2000);
  assert.equal(calls[1].params.endMs, 4000);
  const imported = timelineMediaSchema.parse(
    await service.command("preview.media", {
      ...params,
      startMs: 500,
      endMs: 2000,
      assetId: "import",
      kind: "waveform",
    }),
  );
  assert.equal(imported.channels[0].kind, "asset");
  assert.equal(
    calls[2].params.path,
    await fs.realpath(path.join(service.store.dir(project.id), "media/import.mp4")),
  );
  await assert.rejects(
    service.command("preview.media", { ...params, assetId: "missing" }),
    /not found/,
  );
  await assert.rejects(
    service.command("preview.media", { ...params, assetId: "import" }),
    /inside the source/,
  );
  await assert.rejects(service.command("preview.media", { ...params, startMs: -1 }));
  await fs.appendFile(
    path.join(service.store.dir(project.id), "media/screen.mov"),
    "changed source",
  );
  await service.command("preview.media", params);
  assert.equal(calls.length, 4, "Changed source must invalidate decoded samples");
});
