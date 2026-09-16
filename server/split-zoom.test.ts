import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyEdits } from "@/server/domain/edits.js";
import { ProjectStore } from "@/server/infrastructure/ProjectStore.js";
import { defaultEdits, type Project } from "@/shared/types.js";

function project(): Project {
  return {
    schemaVersion: 2,
    id: "split-zoom",
    name: "Split zoom fixture",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    revision: 0,
    status: "ready",
    source: { durationMs: 10000, width: 1920, height: 1080, fps: 30, screen: "media/screen.mov" },
    edits: {
      ...defaultEdits(),
      segments: [{ startMs: 0, endMs: 10000 }],
      zooms: [
        {
          id: "original-zoom",
          startMs: 1000,
          endMs: 9000,
          x: 0.3,
          y: 0.4,
          scale: 2,
          motion: "snappy",
          followCursor: false,
        },
      ],
    },
    transcript: [],
    assets: [],
  };
}

test("splitting a sped-up reordered clip detaches crossing zoom settings", () => {
  const p = project();
  p.edits.segments = [
    { startMs: 6000, endMs: 10000, speed: 2 },
    { startMs: 0, endMs: 6000, speed: 0.5 },
  ];
  const original = p.edits.zooms[0]!;
  applyEdits(p, [{ type: "split", atMs: 1000 }]);
  const [left, right] = p.edits.zooms;
  assert.deepEqual(left, { ...original, endMs: 8000 });
  assert(right && right.id !== original.id);
  assert.deepEqual(right, { ...original, id: right.id, startMs: 8000 });
  assert.deepEqual(p.edits.segments, [
    { startMs: 6000, endMs: 8000, speed: 2 },
    { startMs: 8000, endMs: 10000, speed: 2 },
    { startMs: 0, endMs: 6000, speed: 0.5 },
  ]);
  applyEdits(p, [{ type: "zoom.update", id: right.id, zoom: { scale: 3, motion: "gentle" } }]);
  assert.equal(left!.scale, 2);
  assert.equal(left!.motion, "snappy");
  assert.equal(right.scale, 3);
  applyEdits(p, [{ type: "zoom.remove", id: right.id }]);
  assert.deepEqual(p.edits.zooms, [left]);
});

test("splitting imported media, existing boundaries or outside a zoom leaves it untouched", () => {
  for (const atMs of [500, 1000, 9000, 9500]) {
    const p = project();
    const zooms = structuredClone(p.edits.zooms);
    applyEdits(p, [{ type: "split", atMs }]);
    assert.deepEqual(p.edits.zooms, zooms);
  }
  const p = project();
  p.edits.segments = [
    { startMs: 0, endMs: 4000 },
    { startMs: 0, endMs: 3000, assetId: "title-card" },
    { startMs: 4000, endMs: 10000 },
  ];
  const zooms = structuredClone(p.edits.zooms);
  for (const atMs of [4000, 5500, 7000]) {
    applyEdits(p, [{ type: "split", atMs }]);
    assert.deepEqual(p.edits.zooms, zooms);
  }
});

test("split zooms persist and undo with their clip split in one history entry", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-split-zoom-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ProjectStore(root);
  let saved = await store.create("Split zoom history");
  const fixture = project();
  saved = await store.mutate(
    saved.id,
    saved.revision,
    (p) => {
      p.source = fixture.source;
      p.status = "ready";
      p.edits = fixture.edits;
    },
    false,
  );
  const original = structuredClone(saved.edits);
  const split = await store.mutate(saved.id, saved.revision, (p) =>
    applyEdits(p, [{ type: "split", atMs: 5000 }]),
  );
  assert.equal(split.edits.zooms.length, 2);
  assert.equal(split.edits.segments.length, 2);
  assert.deepEqual((await new ProjectStore(root).get(split.id)).edits, split.edits);
  const undone = await store.history(split.id, split.revision, "undo");
  assert.deepEqual(undone.edits, original);
  const redone = await store.history(split.id, undone.revision, "redo");
  assert.deepEqual(redone.edits, split.edits);
});
