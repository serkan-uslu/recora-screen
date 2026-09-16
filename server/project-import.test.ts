import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { ApplicationService } from "@/server/services/ApplicationService.js";
import { projectSchema } from "@/server/contracts/validation.js";

test("a video opens as an editable project with its original metadata and embedded audio", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-import-first-"));
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method, params) => {
      assert.ok(!method.startsWith("recording."), "Import must not start a recording");
      if (method === "media.inspect")
        return {
          durationMs: 8000,
          width: 1080,
          height: 1920,
          fps: 24,
          hasAudio: !String(params?.path).endsWith("silent.mov"),
        };
      return {};
    },
  });
  await service.initialize();
  t.after(async () => {
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  });
  const input = path.join(root, "First video.MP4");
  await fs.writeFile(input, "isolated video fixture");
  let imported = projectSchema.parse(await service.command("project.import", { path: input }));
  assert.equal(imported.name, "First video");
  assert.equal(imported.status, "ready");
  assert.deepEqual(imported.source, {
    durationMs: 8000,
    width: 1080,
    height: 1920,
    fps: 24,
    title: "First video.MP4",
    screen: "media/screen.mp4",
    microphone: "media/screen.mp4",
  });
  assert.deepEqual(imported.edits.segments, [{ startMs: 0, endMs: 8000 }]);
  assert.deepEqual(imported.edits.zooms, []);
  await fs.rm(input);
  assert.equal(
    await fs.readFile(await service.store.resolveMedia(imported.id, "media/screen.mp4"), "utf8"),
    "isolated video fixture",
  );
  imported = projectSchema.parse(
    await service.command("timeline.apply", {
      projectId: imported.id,
      expectedRevision: imported.revision,
      operations: [{ type: "cut", startMs: 2000, endMs: 4000 }],
    }),
  );
  const reopened = projectSchema.parse(
    await service.command("project.open", { projectId: imported.id }),
  );
  assert.deepEqual(reopened.edits.segments, [
    { startMs: 0, endMs: 2000 },
    { startMs: 4000, endMs: 8000 },
  ]);
  assert.deepEqual(reopened.source, imported.source);

  const silent = path.join(root, "silent.mov");
  await fs.writeFile(silent, "silent video fixture");
  const withoutAudio = projectSchema.parse(
    await service.command("project.import", { path: silent }),
  );
  assert.equal(withoutAudio.source?.microphone, undefined);

  const invalid = path.join(root, "audio.mp3");
  await fs.writeFile(invalid, "unsupported input");
  await assert.rejects(service.command("project.import", { path: invalid }), {
    code: "INVALID_ASSET",
  });
  const link = path.join(root, "linked.mp4");
  await fs.symlink(silent, link);
  await assert.rejects(service.command("project.import", { path: link }), {
    code: "INVALID_PATH",
  });
  assert.equal((await service.store.list()).length, 2);
});
