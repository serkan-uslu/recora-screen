import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AutoZoomSettings, CursorEvent, TimelineSegment, Zoom } from "@/shared/types.js";
import { subtractRanges } from "@/shared/timeline.js";
import { AppError, finite, time } from "@/server/contracts/validation.js";

// Internal analysis metadata only; the recorded cursor file keeps its original event format.
type CursorActivity = CursorEvent & { typingStartMs?: number };
const typingSampleGapMs = 1200;
const sameTarget = (a: CursorEvent, b: CursorEvent) => Math.hypot(a.x - b.x, a.y - b.y) <= 0.12;

const eventSchema = z
  .object({
    tMs: time,
    x: finite,
    y: finite,
    click: z.boolean().optional(),
    kind: z.enum(["click", "drag", "typing"]).optional(),
  })
  .strict();
// Parse arrays and NDJSON incrementally. Retain activity rather than every pointer sample.
// Long recordings adaptively thin activity to 10,000 candidates; capture duration is never limited.
export async function cursorClicks(file: string): Promise<CursorActivity[]> {
  let clicks: CursorActivity[] = [];
  let item = "",
    quoted = false,
    escaped = false,
    depth = 0,
    pressed = false;
  let anchor: CursorEvent | undefined,
    lastTyping = -Infinity,
    spacingMs = 0;
  function retain(event: CursorEvent) {
    const previous = clicks.at(-1);
    if (
      previous?.kind === "typing" &&
      event.kind === "typing" &&
      event.tMs - previous.tMs <= typingSampleGapMs &&
      sameTarget(previous, event)
    ) {
      previous.typingStartMs ??= previous.tMs;
      previous.tMs = event.tMs;
      return;
    }
    if (event.tMs - (previous?.tMs ?? -Infinity) < spacingMs) return;
    clicks.push(event);
    while (clicks.length > 10000) {
      spacingMs = Math.max(250, spacingMs * 2);
      let last = -Infinity;
      clicks = clicks.filter((candidate) => {
        if (candidate.tMs - last < spacingMs) return false;
        last = candidate.tMs;
        return true;
      });
    }
  }
  for await (const chunk of createReadStream(file, { encoding: "utf8" })) {
    for (const char of chunk) {
      if (!depth) {
        if (/[\s,[\]]/.test(char)) continue;
        if (char !== "{") throw new AppError("INVALID_CURSOR", "Cursor metadata is malformed.");
        depth = 1;
        item = "{";
        continue;
      }
      item += char;
      if (item.length > 4096) throw new AppError("INVALID_CURSOR", "Cursor event exceeds 4 KB.");
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        const event = eventSchema.parse(JSON.parse(item));
        const onScreen = event.x >= 0 && event.x <= 1 && event.y >= 0 && event.y <= 1;
        if (onScreen) {
          if (event.kind === "typing") {
            if (event.tMs - lastTyping >= 600) {
              retain(event);
              lastTyping = event.tMs;
            }
          } else if (event.kind === "drag") {
            retain(event);
            anchor = event;
          } else if (
            (event.kind === "click" && (event.click === undefined || !pressed)) ||
            (event.click && !pressed)
          ) {
            retain(event);
            anchor = event;
          } else if (
            event.click &&
            pressed &&
            anchor &&
            event.tMs - anchor.tMs >= 120 &&
            Math.hypot(event.x - anchor.x, event.y - anchor.y) >= 0.025
          ) {
            retain({ ...event, kind: "drag" });
            anchor = event;
          }
        }
        if (event.click !== undefined) pressed = event.click;
        if (!pressed) anchor = undefined;
        item = "";
      }
    }
  }
  // A crash can omit the final array bracket, but a truncated event must not be silently accepted.
  if (depth) throw new AppError("INVALID_CURSOR", "Cursor metadata ends inside an event.");
  return clicks;
}

export function automaticZooms(
  segments: TimelineSegment[],
  activity: CursorActivity[],
  settings: AutoZoomSettings,
): Zoom[] {
  const zooms: Zoom[] = [];
  const events = activity
    .filter((event) => event.click || event.kind)
    .toSorted((a, b) => (a.typingStartMs ?? a.tMs) - (b.typingStartMs ?? b.tMs));
  // Effects are source-based: repeated footage shares the first occurrence's zoom timing.
  const recorded: TimelineSegment[] = [];
  for (const segment of segments) {
    if (!segment.assetId) recorded.push(...subtractRanges([segment], recorded));
  }
  for (const segment of recorded) {
    const speed = segment.speed ?? 1;
    const clipDuration = (segment.endMs - segment.startMs) / speed;
    let previous: { zoom: Zoom; event: CursorEvent; end: number; activityEnd: number } | undefined;
    for (const event of events) {
      if ((event.typingStartMs ?? event.tMs) >= segment.endMs || event.tMs < segment.startMs)
        continue;
      const output =
        (Math.max(segment.startMs, event.typingStartMs ?? event.tMs) - segment.startMs) / speed;
      const activityEnd = (Math.min(segment.endMs, event.tMs) - segment.startMs) / speed;
      const end = Math.min(clipDuration, activityEnd + settings.holdMs);
      if (
        previous &&
        sameTarget(previous.event, event) &&
        (output <= previous.end + settings.gapMs ||
          (previous.event.kind === "typing" &&
            event.kind === "typing" &&
            output - previous.activityEnd <= typingSampleGapMs / speed))
      ) {
        previous.end = Math.max(previous.end, end);
        previous.activityEnd = activityEnd;
        previous.event = event;
        previous.zoom.endMs = segment.startMs + previous.end * speed;
        continue;
      }
      const earliest = previous ? previous.end + settings.gapMs : 0;
      // A compacted typing interval may begin during cooldown and continue past it.
      if (activityEnd < earliest || end - Math.max(output, earliest) < 200) continue;
      const zoom: Zoom = {
        id: randomUUID(),
        startMs: segment.startMs + Math.max(earliest, output - settings.leadMs) * speed,
        endMs: segment.startMs + end * speed,
        x: event.x,
        y: event.y,
        scale: settings.scale,
        motion: settings.motion,
        followCursor: settings.followCursor,
      };
      zooms.push(zoom);
      previous = { zoom, event, end, activityEnd };
    }
  }
  return zooms;
}
