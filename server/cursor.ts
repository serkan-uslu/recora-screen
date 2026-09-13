import { createReadStream } from 'node:fs';
import { z } from 'zod';
import type { CursorEvent } from '../shared/types.js';
import { AppError, finite, time } from './validation.js';

const eventSchema = z.object({ tMs: time, x: finite, y: finite, click: z.boolean().optional() }).strict();
// Recording files contain flat JSON objects in an array (or NDJSON). Only click edges are needed for auto-zoom.
export async function cursorClicks(file: string): Promise<CursorEvent[]> {
  const clicks: CursorEvent[] = [];
  let item = '', quoted = false, escaped = false, depth = 0, pressed = false;
  for await (const chunk of createReadStream(file, { encoding: 'utf8' })) {
    for (const char of chunk) {
      if (!depth) {
        if (/[\s,\[\]]/.test(char)) continue;
        if (char !== '{') throw new AppError('INVALID_CURSOR', 'Cursor metadata is malformed.');
        depth = 1; item = '{'; continue;
      }
      item += char;
      if (item.length > 4096) throw new AppError('INVALID_CURSOR', 'Cursor event exceeds 4 KB.');
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) {
        const event = eventSchema.parse(JSON.parse(item));
        if (event.click && !pressed && event.x >= 0 && event.x <= 1 && event.y >= 0 && event.y <= 1) clicks.push(event);
        pressed = !!event.click; item = '';
      }
    }
  }
  // A crash can omit the final array bracket, but a truncated event must not be silently accepted.
  if (depth) throw new AppError('INVALID_CURSOR', 'Cursor metadata ends inside an event.');
  return clicks;
}
