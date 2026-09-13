import type { Range } from './types.js';

export const duration = (segments: Range[]) => segments.reduce((n, r) => n + r.endMs - r.startMs, 0);

export function sourceTime(segments: Range[], timelineMs: number): number {
  let remaining = Math.max(0, timelineMs);
  for (const range of segments) {
    const length = range.endMs - range.startMs;
    if (remaining < length) return range.startMs + remaining;
    remaining -= length;
  }
  return segments.at(-1)?.endMs ?? 0;
}

export function timelineTime(segments: Range[], sourceMs: number): number | null {
  let elapsed = 0;
  for (const range of segments) {
    if (sourceMs >= range.startMs && sourceMs < range.endMs) return elapsed + sourceMs - range.startMs;
    elapsed += range.endMs - range.startMs;
  }
  return null;
}

export function sourceRanges(segments: Range[], startMs: number, endMs: number): Range[] {
  const result: Range[] = [];
  let elapsed = 0;
  for (const range of segments) {
    const length = range.endMs - range.startMs;
    const a = Math.max(startMs, elapsed), b = Math.min(endMs, elapsed + length);
    if (b > a) result.push({ startMs: range.startMs + a - elapsed, endMs: range.startMs + b - elapsed });
    elapsed += length;
  }
  return result;
}

export function subtractRanges(segments: Range[], cuts: Range[]): Range[] {
  return cuts.reduce((ranges, cut) => ranges.flatMap(range => {
    if (cut.endMs <= range.startMs || cut.startMs >= range.endMs) return [range];
    const kept: Range[] = [];
    if (cut.startMs > range.startMs) kept.push({ startMs: range.startMs, endMs: cut.startMs });
    if (cut.endMs < range.endMs) kept.push({ startMs: cut.endMs, endMs: range.endMs });
    return kept;
  }), segments);
}

export const formatTime = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};
