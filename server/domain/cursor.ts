import { createReadStream } from "node:fs";
import { z } from "zod";
import type { CursorEvent } from "@/shared/types.js";
import { AppError, finite, time } from "@/server/contracts/validation.js";

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
export async function cursorClicks(file: string): Promise<CursorEvent[]> {
  let clicks: CursorEvent[] = [];
  let item = "",
    quoted = false,
    escaped = false,
    depth = 0,
    pressed = false;
  let anchor: CursorEvent | undefined,
    lastTyping = -Infinity,
    spacingMs = 0;
  function retain(event: CursorEvent) {
    if (event.tMs - (clicks.at(-1)?.tMs ?? -Infinity) < spacingMs) return;
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
