import test from "node:test";
import assert from "node:assert/strict";
import { previewTransform } from "@/src/controllers/usePreviewEditingController.js";
import type { PreviewItem } from "@/src/controllers/previewPlayback.js";

const near = (actual: number, expected: number) =>
  assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const camera = (width: number, height: number): PreviewItem => ({
  kind: "camera",
  id: "camera",
  x: 0.3,
  y: 0.25,
  width: 0.2,
  height: (0.2 * width) / height,
});

test("camera dragging uses displayed CSS bounds in landscape, portrait and Retina rather than video pixels", () => {
  for (const [width, height] of [
    [960, 540],
    [540, 960],
    [1920, 1080],
  ]) {
    const item = camera(width!, height!);
    const result = previewTransform(
      { item, corner: null, width: width!, height: height! },
      width! * 0.1,
      height! * 0.1,
    );
    near(result.x, 0.4);
    near(result.y, 0.35);
    near(result.width, item.width);
    near(result.scale, 1);
  }
});

test("dragging clamped camera geometry uses the visible position and keeps it inside the canvas", () => {
  const item = { ...camera(960, 540), x: 0.8, y: 1 - (0.2 * 960) / 540 };
  const gesture = { item, corner: null, width: 960, height: 540 };
  const left = previewTransform(gesture, -96, -54);
  near(left.x, 0.7);
  near(left.y, item.y - 0.1);
  const outward = previewTransform(gesture, 1000, 1000);
  near(outward.x, 1 - item.width);
  near(outward.y, 1 - item.height);
  const origin = previewTransform(gesture, -1000, -1000);
  near(origin.x, 0);
  near(origin.y, 0);
});

test("all camera corners preserve the opposite anchor and circular pixel aspect on portrait and landscape canvases", () => {
  for (const [width, height] of [
    [1000, 1000],
    [960, 540],
    [540, 960],
  ]) {
    const item = camera(width!, height!);
    for (const corner of ["nw", "ne", "sw", "se"]) {
      const left = corner.includes("w"),
        top = corner.includes("n");
      const result = previewTransform(
        { item, corner, width: width!, height: height! },
        ((left ? -1 : 1) * item.width * width!) / 2,
        ((top ? -1 : 1) * item.height * height!) / 2,
      );
      near(result.scale, 1.5);
      near(result.width, 0.3);
      near(result.x + (left ? result.width : 0), item.x + (left ? item.width : 0));
      near(result.y + (top ? item.height * result.scale : 0), item.y + (top ? item.height : 0));
      near(result.width * width!, item.height * result.scale * height!);
    }
  }
});

test("camera resizing clamps extreme drags and honors available height on a very wide canvas", () => {
  const width = 1200,
    height = 300,
    item = { ...camera(width, height), x: 0.1, y: 0.1 };
  const large = previewTransform({ item, corner: "se", width, height }, 100000, 100000);
  near(large.width, 0.25);
  near(item.height * large.scale, 1);
  near(large.y, 0);
  const tiny = previewTransform({ item, corner: "se", width, height }, -100000, -100000);
  near(tiny.width, 0.08);
  assert(Number.isFinite(tiny.scale));
});

test("image resize retains its physical aspect and text resize returns the matching font scale", () => {
  const width = 960,
    height = 540;
  for (const [kind, visualHeight] of [
    ["image", 0.2],
    ["text", 0.08],
  ] as const) {
    const item: PreviewItem = {
      kind: "overlay",
      id: kind,
      x: 0.1,
      y: 0.1,
      width: 0.3,
      height: visualHeight,
    };
    const result = previewTransform(
      { item, corner: "se", width, height },
      item.width * width * 0.25,
      item.height * height * 0.25,
    );
    near(result.scale, 1.25);
    near(result.width, 0.375);
    near(
      (result.width * width) / (item.height * result.scale * height),
      (item.width * width) / (item.height * height),
    );
    if (kind === "text") near(40 * result.scale, 50);
    const move = previewTransform({ item, corner: null, width, height }, width * 0.2, height * 0.3);
    near(move.x, 0.3);
    near(move.y, 0.4);
    near(move.width, item.width);
    near(move.scale, 1);
  }
});

test("text corner resizing scales glyphs with fixed native padding and keeps the opposite corner anchored", () => {
  for (const [canvasWidth, canvasHeight, displayWidth, displayHeight] of [
    [1920, 1080, 960, 540],
    [2160, 3840, 540, 960],
  ]) {
    const width = canvasWidth!,
      height = canvasHeight!;
    const text = { fontSize: 40, canvasWidth: width, canvasHeight: height };
    const item: PreviewItem = {
      kind: "overlay",
      id: "text",
      x: 0.3,
      y: 0.3,
      width: (600 + 24) / width,
      height: (80 + 26) / height,
    };
    for (const corner of ["nw", "ne", "sw", "se"]) {
      const left = corner.includes("w"),
        top = corner.includes("n");
      const dx = (((left ? -1 : 1) * 600) / width) * displayWidth! * 0.5;
      const dy = (((top ? -1 : 1) * 80) / height) * displayHeight! * 0.5;
      const result = previewTransform(
        { item, corner, width: displayWidth!, height: displayHeight!, text },
        dx,
        dy,
      );
      near(result.scale, 1.5);
      near(result.width * width, 900 + 24);
      near(result.height * height, 120 + 26);
      near(result.x + (left ? result.width : 0), item.x + (left ? item.width : 0));
      near(result.y + (top ? result.height : 0), item.y + (top ? item.height : 0));
    }
    const capped = previewTransform(
      {
        item,
        corner: "nw",
        width: displayWidth!,
        height: displayHeight!,
        text: { ...text, fontSize: 190 },
      },
      -200,
      -200,
    );
    near(capped.scale, 200 / 190);
    near(capped.y + capped.height, item.y + item.height);
  }
});

test("geometry resolving after pointer-up replays the released position and commits a traveled drag once", async () => {
  const { replayPreviewGesture } = await import("@/src/controllers/usePreviewEditingController.js");
  let resolve!: () => void;
  const geometry = new Promise<void>((done) => {
    resolve = done;
  });
  const start = { x: 100, y: 200 },
    releasedAt = { x: 165, y: 242 };
  const calls: unknown[] = [];
  // The release position is retained while a delayed native geometry response is in flight.
  const done = geometry.then(() =>
    replayPreviewGesture(start, releasedAt, true, {
      start: () => calls.push("start"),
      move: (x, y) => calls.push({ x, y }),
      finish: () => calls.push("commit"),
    }),
  );
  assert.equal(calls.length, 0);
  resolve();
  await done;
  assert.deepEqual(calls, ["start", releasedAt, "commit"]);
  replayPreviewGesture(start, start, true, {
    start: () => assert.fail("A click is selection only"),
    move: () => assert.fail("No movement"),
    finish: () => assert.fail("No edit"),
  });
  replayPreviewGesture(start, releasedAt, false, {
    start: () => calls.push("active"),
    move: () => {},
    finish: () => assert.fail("Still pressed"),
  });
  assert.equal(calls.at(-1), "active");
});
