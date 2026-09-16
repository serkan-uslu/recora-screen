import test from "node:test";
import assert from "node:assert/strict";
import { defaultEdits, type Project } from "@/shared/types";
import { applyEdits } from "@/server/domain/edits";
import {
  cameraSource,
  clipSource,
  targetAfterEdit,
  targetRange,
  previewCameraRange,
  targetPreviewTime,
  type EditorTarget,
} from "@/src/controllers/editorSelection";

const fixture = (): Project => ({
  schemaVersion: 2,
  id: "selection-test",
  name: "Selection test",
  createdAt: "2026-09-16",
  updatedAt: "2026-09-16",
  revision: 1,
  status: "ready",
  assets: [],
  transcript: [],
  source: {
    durationMs: 10000,
    width: 640,
    height: 360,
    fps: 30,
    screen: "media/screen.mov",
    camera: "media/camera.mov",
  },
  edits: {
    ...defaultEdits(),
    segments: [
      { startMs: 0, endMs: 5000 },
      { startMs: 5000, endMs: 10000 },
    ],
    zooms: [{ id: "zoom", startMs: 0, endMs: 2000, scale: 1.7, x: 0.5, y: 0.5 }],
  },
});

test("selection survives property edits, follows moved clips and rejects stale camera ranges", () => {
  const project = fixture();
  const clip: EditorTarget = {
    kind: "clip",
    index: 1,
    source: clipSource(project.edits.segments[1]!),
  };
  const camera: EditorTarget = {
    kind: "camera",
    range: { startMs: 5000, endMs: 10000 },
    source: cameraSource(project),
  };
  const changed = structuredClone(project);
  applyEdits(changed, [
    { type: "camera.layout.set", startMs: 5000, endMs: 10000, settings: { mirror: true } },
  ]);
  assert.deepEqual(targetRange(changed, camera), camera.range);
  const moved = structuredClone(changed);
  const move = { type: "clip.move", index: 1, toIndex: 0 } as const;
  applyEdits(moved, [move]);
  const selected = targetAfterEdit(clip, changed, moved, [move]);
  assert.deepEqual(selected, { ...clip, index: 0 });
  assert.deepEqual(selected && targetRange(moved, selected), { startMs: 0, endMs: 5000 });
  assert.equal(targetRange(moved, camera), null);
  const removed = structuredClone(project);
  removed.edits.zooms = [];
  assert.equal(targetRange(removed, { kind: "zoom", id: "zoom" }), null);
});

test("preview camera selection follows the clicked frame and respects video default scope", () => {
  const project = fixture();
  const first = { startMs: 0, endMs: 5000 };
  assert.deepEqual(previewCameraRange(project, 8000, first, "selection", true), {
    startMs: 5000,
    endMs: 10000,
  });
  assert.deepEqual(
    previewCameraRange(project, 2000, { startMs: 1000, endMs: 3000 }, "selection", true),
    { startMs: 1000, endMs: 3000 },
  );
  assert.deepEqual(previewCameraRange(project, 8000, first, "entire", true), {
    startMs: 0,
    endMs: 10000,
  });
});

test("effect preview seeks an actual occurrence instead of an inserted-media gap", () => {
  const project = fixture();
  project.edits.segments = [
    { startMs: 0, endMs: 1000 },
    { startMs: 0, endMs: 2000, assetId: "insert" },
    { startMs: 1000, endMs: 10000 },
  ];
  assert.deepEqual(targetRange(project, { kind: "zoom", id: "zoom" }), { startMs: 0, endMs: 4000 });
  assert.equal(targetPreviewTime(project, { kind: "zoom", id: "zoom" }, 2000), 500);
  assert.equal(targetPreviewTime(project, { kind: "zoom", id: "zoom" }, 3500), 3500);
});
