import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { automaticZooms, cursorClicks } from "@/server/domain/cursor.js";
import { defaultAutoZoom, type CursorEvent, type Zoom } from "@/shared/types.js";

const ranges = (zooms: Zoom[]) => zooms.map(({ startMs, endMs }) => ({ startMs, endMs }));
const typing = (tMs: number): CursorEvent => ({ tMs, x: 0.3, y: 0.4, kind: "typing" });

test("continuous typing holds one zoom, including short holds at slow playback speed", () => {
  const activity = Array.from({ length: 100 }, (_, index) => typing(1000 + index * 700));
  for (const speed of [0.5, 1, 2]) {
    const settings = { ...defaultAutoZoom(), holdMs: 200, gapMs: 0 };
    const zooms = automaticZooms([{ startMs: 0, endMs: 80000, speed }], activity, settings);
    assert.deepEqual(ranges(zooms), [
      { startMs: 1000 - settings.leadMs * speed, endMs: 70300 + settings.holdMs * speed },
    ]);
  }
});

test("idle and changed targets create separate zooms without overlapping lead-ins", () => {
  const zooms = automaticZooms(
    [{ startMs: 0, endMs: 15000 }],
    [
      { tMs: 1000, x: 0.1, y: 0.1, click: true },
      { tMs: 2200, x: 0.8, y: 0.8, kind: "drag" },
      { tMs: 7200, x: 0.8, y: 0.8, kind: "typing" },
      { tMs: 10000, x: 0.1, y: 0.1, click: true },
    ],
    { ...defaultAutoZoom(), leadMs: 1500, holdMs: 800, gapMs: 200 },
  );
  assert.deepEqual(ranges(zooms), [
    { startMs: 0, endMs: 1800 },
    { startMs: 2000, endMs: 3000 },
    { startMs: 5700, endMs: 8000 },
    { startMs: 8500, endMs: 10800 },
  ]);
});

test("long typing retains its full interval across trim, reorder and speed changes", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-auto-zoom-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "cursor.json");
  await fs.writeFile(
    file,
    Array.from({ length: 11000 }, (_, index) => JSON.stringify(typing(index * 700))).join("\n"),
  );
  const events = await cursorClicks(file);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.tMs, 10999 * 700);
  const settings = defaultAutoZoom();
  assert.deepEqual(ranges(automaticZooms([{ startMs: 0, endMs: 8000000 }], events, settings)), [
    { startMs: 0, endMs: 10999 * 700 + settings.holdMs },
  ]);
  assert.deepEqual(
    ranges(
      automaticZooms(
        [
          { startMs: 10000, endMs: 20000, speed: 2 },
          { startMs: 0, endMs: 3000, assetId: "title-card" },
          { startMs: 0, endMs: 10000, speed: 0.5 },
        ],
        events,
        settings,
      ),
    ),
    [
      { startMs: 10000, endMs: 20000 },
      { startMs: 0, endMs: 10000 },
    ],
  );
  await fs.writeFile(file, JSON.stringify([{ ...typing(0), typingStartMs: -100 }]));
  await assert.rejects(
    cursorClicks(file),
    "internal interval metadata is not accepted from recordings",
  );
  await fs.writeFile(file, '[{"tMs":1');
  await assert.rejects(cursorClicks(file), { code: "INVALID_CURSOR" });
});

test("a typing interval that starts during another target's cooldown is retained", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-auto-zoom-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "cursor.json");
  await fs.writeFile(
    file,
    JSON.stringify([
      { tMs: 0, x: 0.9, y: 0.9, click: true },
      ...Array.from({ length: 10 }, (_, index) => typing(600 + index * 700)),
    ]),
  );
  const zooms = automaticZooms(
    [{ startMs: 0, endMs: 10000 }],
    await cursorClicks(file),
    defaultAutoZoom(),
  );
  assert.deepEqual(ranges(zooms), [
    { startMs: 0, endMs: 1600 },
    { startMs: 2200, endMs: 8500 },
  ]);
});

test("repeated source footage shares first-occurrence zooms without overlapping duplicates", () => {
  const zooms = automaticZooms(
    [
      { startMs: 0, endMs: 10000, speed: 2 },
      { startMs: 0, endMs: 10000, speed: 0.5 },
      { startMs: 5000, endMs: 15000, speed: 0.5 },
    ],
    [typing(3000), typing(9000), typing(12000)],
    defaultAutoZoom(),
  );
  assert.deepEqual(ranges(zooms), [
    { startMs: 2200, endMs: 6200 },
    { startMs: 8200, endMs: 10000 },
    { startMs: 11800, endMs: 12800 },
  ]);
});
