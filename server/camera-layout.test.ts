import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { ProjectStore } from "@/server/infrastructure/ProjectStore.js";
import { applyEdits } from "@/server/domain/edits.js";
import { parseProject, projectSchema } from "@/server/contracts/validation.js";
import { cameraAt, cameraOutputLayouts } from "@/shared/camera.js";
import type { Project } from "@/shared/types.js";
import { cameraEdit, cameraVisibilityEdits } from "@/src/controllers/cameraEdit.js";

async function setup(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-camera-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ProjectStore(root);
  let project = await store.create("Camera layouts");
  project = await store.mutate(
    project.id,
    project.revision,
    (p) => {
      p.status = "ready";
      p.source = {
        durationMs: 10000,
        width: 1920,
        height: 1080,
        fps: 30,
        screen: "media/screen.mov",
      };
      p.edits.segments = [{ startMs: 0, endMs: 10000 }];
    },
    false,
  );
  return { store, project, dir: store.dir(project.id) };
}
const times = (project: Project) =>
  project.edits.camera.layouts.map(({ startMs, endMs, x, size }) => ({ startMs, endMs, x, size }));

test("split camera settings and visibility stay in their range through persistence and undo", async (t) => {
  const { store, project: original } = await setup(t);
  const first = { startMs: 0, endMs: 5000 },
    second = { startMs: 5000, endMs: 10000 };
  let project = await store.mutate(original.id, original.revision, (p) =>
    applyEdits(p, [{ type: "split", atMs: 5000 }]),
  );
  project = await store.mutate(project.id, project.revision, (p) =>
    applyEdits(p, [
      cameraEdit(second, "selection", { shape: "square" }),
      cameraEdit(second, "selection", { mirror: true }),
      ...cameraVisibilityEdits(p, second, "selection", false),
    ]),
  );
  assert.equal(cameraAt(project, 2500).shape, original.edits.camera.shape);
  assert.equal(cameraAt(project, 2500).mirror ?? false, false);
  assert.equal(cameraAt(project, 7500).shape, "square");
  assert.equal(cameraAt(project, 7500).mirror, true);
  assert.deepEqual(project.edits.camera.hiddenRanges, [second]);
  const ranged = structuredClone(project);
  project = await store.mutate(project.id, project.revision, (p) =>
    applyEdits(p, cameraVisibilityEdits(p, first, "entire", false)),
  );
  const globallyHidden = structuredClone(project);
  project = await store.mutate(project.id, project.revision, (p) =>
    applyEdits(p, cameraVisibilityEdits(p, second, "selection", true)),
  );
  assert.equal(project.edits.camera.visible, true);
  assert.deepEqual(project.edits.camera.hiddenRanges, [first]);
  assert.deepEqual(project.edits.camera.layouts, ranged.edits.camera.layouts);
  assert.deepEqual((await new ProjectStore(store.root).get(project.id)).edits, project.edits);
  const undone = await store.history(project.id, project.revision, "undo");
  assert.deepEqual(undone.edits, globallyHidden.edits);
  const redone = await store.history(project.id, undone.revision, "redo");
  assert.deepEqual(redone.edits, project.edits);
});

test("camera layouts preserve disjoint source spans, partial overlap, history and source restoration", async (t) => {
  const { store, project: original } = await setup(t);
  let project = await store.mutate(original.id, original.revision, (p) =>
    applyEdits(p, [
      { type: "cut", startMs: 2000, endMs: 4000 },
      { type: "camera.layout.set", startMs: 1000, endMs: 3000, settings: { x: 0.1, size: 0.3 } },
    ]),
  );
  assert.deepEqual(times(project), [
    { startMs: 1000, endMs: 2000, x: 0.1, size: 0.3 },
    { startMs: 4000, endMs: 5000, x: 0.1, size: 0.3 },
  ]);
  const beforePatch = structuredClone(project);
  project = await store.mutate(project.id, project.revision, (p) =>
    applyEdits(p, [
      { type: "camera.layout.set", startMs: 1500, endMs: 2500, settings: { size: 0.4 } },
    ]),
  );
  assert.deepEqual(times(project), [
    { startMs: 1000, endMs: 1500, x: 0.1, size: 0.3 },
    { startMs: 1500, endMs: 2000, x: 0.1, size: 0.4 },
    { startMs: 4000, endMs: 4500, x: 0.1, size: 0.4 },
    { startMs: 4500, endMs: 5000, x: 0.1, size: 0.3 },
  ]);
  assert.deepEqual((await new ProjectStore(store.root).get(project.id)).edits, project.edits);
  const undone = await store.history(project.id, project.revision, "undo");
  assert.deepEqual(undone.edits, beforePatch.edits);
  const redone = await store.history(project.id, undone.revision, "redo");
  assert.deepEqual(redone.edits, project.edits);
  applyEdits(project, [{ type: "source.restore", startMs: 2000, endMs: 4000 }]);
  assert.equal(
    cameraAt(project, 3000).x,
    original.edits.camera.x,
    "restored source gap retains the base layout",
  );
  applyEdits(project, [{ type: "camera.layout.remove", startMs: 1250, endMs: 4750 }]);
  assert.deepEqual(times(project), [
    { startMs: 1000, endMs: 1250, x: 0.1, size: 0.3 },
    { startMs: 4750, endMs: 5000, x: 0.1, size: 0.3 },
  ]);
  assert(projectSchema.safeParse(project).success);
});

test("splitting layout IDs remains valid, adjacent targets coalesce, and global edits preserve interval targets", async (t) => {
  const { project } = await setup(t);
  applyEdits(project, [
    { type: "camera.layout.set", startMs: 1000, endMs: 7000, settings: { x: 0.2 } },
    { type: "camera.layout.remove", startMs: 3000, endMs: 4000 },
  ]);
  assert.equal(new Set(project.edits.camera.layouts.map((l) => l.id)).size, 2);
  assert(projectSchema.safeParse(project).success);
  applyEdits(project, [
    { type: "camera.layout.set", startMs: 3000, endMs: 4000, settings: { x: 0.2 } },
  ]);
  assert.equal(project.edits.camera.layouts.length, 1);
  applyEdits(project, [{ type: "camera.update", settings: { x: 0.9 } }]);
  assert.equal(cameraAt(project, 5000).x, 0.2);
  assert.equal(cameraAt(project, 8000).x, 0.9);
  assert.throws(
    () =>
      applyEdits(project, [
        { type: "camera.layout.set", startMs: 0, endMs: 11000, settings: { x: 0.1 } },
      ]),
    { code: "INVALID_RANGE" },
  );
  assert.throws(() =>
    applyEdits(project, [
      { type: "camera.layout.set", startMs: 0, endMs: 500, settings: { x: 2 } },
    ]),
  );
});

test("camera transitions use output time across cuts and speed, with one centered transition between neighbors", async (t) => {
  const { project } = await setup(t);
  project.edits.camera.x = 0;
  applyEdits(project, [
    { type: "camera.layout.set", startMs: 1000, endMs: 6000, settings: { x: 1, shape: "square" } },
    { type: "camera.layout.set", startMs: 6000, endMs: 8000, settings: { x: 0.5 } },
    { type: "cut", startMs: 2000, endMs: 4000 },
    { type: "speed", startMs: 0, endMs: 8000, speed: 2 },
  ]);
  assert.deepEqual(
    cameraOutputLayouts(project).map((r) => [r.startMs, r.endMs, r.x]),
    [
      [0, 500, 0],
      [500, 2000, 1],
      [2000, 3000, 0.5],
      [3000, 4000, 0],
    ],
  );
  assert.equal(cameraAt(project, 350).x, 0);
  assert.equal(cameraAt(project, 425).x, 0.15625);
  assert.equal(cameraAt(project, 500).x, 0.5);
  assert.equal(cameraAt(project, 500).shape, "square");
  assert.equal(cameraAt(project, 1000).x, 1, "the source cut does not restart the transition");
  assert.equal(cameraAt(project, 2000).x, 0.75, "adjacent target layouts have a single transition");
  project.edits.segments = [{ startMs: 0, endMs: 10000, speed: 8 }];
  applyEdits(project, [
    { type: "camera.layout.set", startMs: 25, endMs: 50, settings: { x: 0.8 } },
  ]);
  assert(Number.isFinite(cameraAt(project, 25).x));
  assert.equal(
    cameraAt(project, 37.5).x,
    0.8,
    "short intervals reach their target before the next transition",
  );
});

function legacy(project: Project) {
  const { layouts: _, ...camera } = project.edits.camera;
  return { ...project, schemaVersion: 1, edits: { ...project.edits, camera } };
}
test("v1 migration archives exact originals and upgrades current, backup and both history stacks once", async (t) => {
  const { store, project, dir } = await setup(t);
  const original = legacy(project);
  const manifest = JSON.stringify({
    project: original,
    undo: [{ ...original, name: "Undo name" }],
    redo: [{ ...original, name: "Redo name" }],
  });
  const backup = JSON.stringify({
    project: { ...original, name: "Backup name" },
    undo: [original],
    redo: [],
  });
  await fs.writeFile(path.join(dir, "project.json"), manifest);
  await fs.writeFile(path.join(dir, "project.backup.json"), backup);
  const fresh = new ProjectStore(store.root);
  const opened = await Promise.all([
    fresh.get(project.id),
    fresh.get(project.id),
    fresh.read(project.id),
  ]);
  assert.equal(opened[0]!.schemaVersion, 2);
  assert.equal(await fs.readFile(path.join(dir, "project.pre-v2.json"), "utf8"), manifest);
  assert.equal(await fs.readFile(path.join(dir, "project.backup.pre-v2.json"), "utf8"), backup);
  const migrated = await fresh.read(project.id);
  assert.equal(migrated.undo[0]!.schemaVersion, 2);
  assert.equal(migrated.redo[0]!.schemaVersion, 2);
  assert.deepEqual(migrated.project.edits.camera.layouts, []);
  assert.equal(
    JSON.parse(await fs.readFile(path.join(dir, "project.backup.json"), "utf8")).project.name,
    "Backup name",
  );
  const undone = await fresh.history(project.id, project.revision, "undo");
  assert.equal(undone.name, "Undo name");
  const redone = await fresh.history(project.id, undone.revision, "redo");
  assert.equal(redone.name, project.name);
  assert.equal(await fs.readFile(path.join(dir, "project.pre-v2.json"), "utf8"), manifest);
  assert.deepEqual(await new ProjectStore(store.root).get(project.id), redone);
});

test("interrupted migration resumes with the already upgraded backup; corruption recovers without losing v2 layouts", async (t) => {
  const { store, project, dir } = await setup(t);
  await fs.writeFile(
    path.join(dir, "project.json"),
    JSON.stringify({ project: legacy(project), undo: [], redo: [] }),
  );
  await fs.writeFile(
    path.join(dir, "project.backup.json"),
    JSON.stringify({ project, undo: [], redo: [] }),
  );
  const fresh = new ProjectStore(store.root);
  const migrated = await fresh.get(project.id);
  const updated = await fresh.mutate(project.id, migrated.revision, (p) =>
    applyEdits(p, [
      { type: "camera.layout.set", startMs: 1000, endMs: 5000, settings: { x: 0.1 } },
    ]),
  );
  await fresh.mutate(project.id, updated.revision, (p) => {
    p.name = "Latest";
  });
  await fs.writeFile(path.join(dir, "project.json"), "{broken");
  const recovered = await fresh.get(project.id);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.edits.camera.layouts[0]!.x, 0.1);
  assert.equal(recovered.schemaVersion, 2);
});

test("unsupported project or history versions never fall back or overwrite original documents", async (t) => {
  const { store, project, dir } = await setup(t);
  for (const document of [
    { project: { ...project, schemaVersion: 3 }, undo: [], redo: [] },
    { project, undo: [{ ...project, schemaVersion: 3 }], redo: [] },
  ]) {
    const text = JSON.stringify(document);
    await fs.writeFile(path.join(dir, "project.json"), text);
    await fs.writeFile(
      path.join(dir, "project.backup.json"),
      JSON.stringify({ project, undo: [], redo: [] }),
    );
    await assert.rejects(new ProjectStore(store.root).get(project.id), {
      code: "UNSUPPORTED_PROJECT_VERSION",
    });
    await assert.rejects(store.persist({ project, undo: [], redo: [] }), {
      code: "UNSUPPORTED_PROJECT_VERSION",
    });
    assert.equal(await fs.readFile(path.join(dir, "project.json"), "utf8"), text);
  }
  assert.throws(
    () => parseProject({ ...legacy(project), edits: { ...project.edits } }),
    /layouts/,
    "v1 schema does not accept unrecognized v2 fields",
  );
});

test("camera layout mapping revisits earlier layouts after reordered clips and inserted media", async (t) => {
  const { project } = await setup(t);
  applyEdits(project, [
    { type: "camera.layout.set", startMs: 0, endMs: 2000, settings: { x: 0.1 } },
    { type: "camera.layout.set", startMs: 7000, endMs: 10000, settings: { x: 0.7 } },
  ]);
  project.edits.segments = [
    { startMs: 7000, endMs: 10000 },
    { assetId: "still", startMs: 0, endMs: 2000 },
    { startMs: 0, endMs: 2000 },
  ];
  assert.equal(cameraAt(project, 1000).x, 0.7);
  assert.equal(cameraAt(project, 4000).x, project.edits.camera.x);
  assert.equal(cameraAt(project, 6000).x, 0.1);
});
