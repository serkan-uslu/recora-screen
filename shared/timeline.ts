import type { Project, Range, TimelineSegment } from "@/shared/types.js";

export const segmentDuration = (segment: TimelineSegment) =>
  (segment.endMs - segment.startMs) / (segment.speed ?? 1);
export const duration = (segments: TimelineSegment[]) =>
  segments.reduce((n, r) => n + segmentDuration(r), 0);

export function sourceTime(segments: TimelineSegment[], timelineMs: number): number {
  let remaining = Math.max(0, timelineMs);
  for (const range of segments) {
    const length = segmentDuration(range);
    if (remaining < length)
      return range.assetId ? -1 : range.startMs + remaining * (range.speed ?? 1);
    remaining -= length;
  }
  const last = segments.at(-1);
  return last?.assetId ? -1 : (last?.endMs ?? 0);
}

export function timelineTime(segments: TimelineSegment[], sourceMs: number): number | null {
  let elapsed = 0;
  for (const range of segments) {
    if (!range.assetId && sourceMs >= range.startMs && sourceMs < range.endMs)
      return elapsed + (sourceMs - range.startMs) / (range.speed ?? 1);
    elapsed += segmentDuration(range);
  }
  return null;
}

export function sliceSegments(
  segments: TimelineSegment[],
  startMs: number,
  endMs: number,
): TimelineSegment[] {
  const result: TimelineSegment[] = [];
  let elapsed = 0;
  for (const range of segments) {
    const length = segmentDuration(range),
      speed = range.speed ?? 1;
    const a = Math.max(startMs, elapsed),
      b = Math.min(endMs, elapsed + length);
    if (b > a)
      result.push({
        ...range,
        startMs:
          a === elapsed
            ? range.startMs
            : Math.min(range.endMs, range.startMs + (a - elapsed) * speed),
        endMs:
          b === elapsed + length
            ? range.endMs
            : Math.min(range.endMs, range.startMs + (b - elapsed) * speed),
      });
    elapsed += length;
  }
  return result;
}

export function sourceRanges(segments: TimelineSegment[], startMs: number, endMs: number): Range[] {
  return sliceSegments(segments, startMs, endMs)
    .filter((segment) => !segment.assetId)
    .map(({ startMs, endMs }) => ({ startMs, endMs }));
}

export function outputRanges(segments: TimelineSegment[], range: Range): Range[] {
  let elapsed = 0;
  const result: Range[] = [];
  for (const segment of segments) {
    const startMs = Math.max(segment.startMs, range.startMs),
      endMs = Math.min(segment.endMs, range.endMs),
      speed = segment.speed ?? 1;
    if (!segment.assetId && endMs > startMs)
      result.push({
        startMs: elapsed + (startMs - segment.startMs) / speed,
        endMs: elapsed + (endMs - segment.startMs) / speed,
      });
    elapsed += segmentDuration(segment);
  }
  return result;
}

export function subtractRanges<T extends Range>(segments: T[], cuts: Range[]): T[] {
  return cuts.reduce(
    (ranges, cut) =>
      ranges.flatMap((range) => {
        if (cut.endMs <= range.startMs || cut.startMs >= range.endMs) return [range];
        const kept: T[] = [];
        if (cut.startMs > range.startMs) kept.push({ ...range, endMs: cut.startMs });
        if (cut.endMs < range.endMs) kept.push({ ...range, startMs: cut.endMs });
        return kept;
      }),
    segments,
  );
}

export function outputSize(
  project: Project,
  quality: "720" | "1080" | "4k" = "1080",
): { width: number; height: number } {
  const multiplier = quality === "4k" ? 2 : quality === "720" ? 2 / 3 : 1;
  const sizes = {
    "16:9": [1920, 1080],
    "9:16": [1080, 1920],
    "1:1": [1080, 1080],
    "4:5": [1080, 1350],
  } as const;
  const aspect = project.edits.canvas?.aspectRatio ?? "source";
  if (aspect !== "source")
    return {
      width: Math.round((sizes[aspect][0] * multiplier) / 2) * 2,
      height: Math.round((sizes[aspect][1] * multiplier) / 2) * 2,
    };
  const width = project.source?.width ?? 1920,
    height = project.source?.height ?? 1080;
  const scale = (1920 * multiplier) / Math.max(width, height);
  return {
    width: Math.max(16, Math.round((width * scale) / 2) * 2),
    height: Math.max(16, Math.round((height * scale) / 2) * 2),
  };
}

export const formatTime = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
};

/** Images can be held for up to one minute; video trim bounds come from inspected media. */
export function segmentSourceDuration(project: Project, segment: TimelineSegment): number {
  if (!segment.assetId) return project.source?.durationMs ?? 0;
  const asset = project.assets.find((asset) => asset.id === segment.assetId);
  return asset?.kind === "image" ? 60000 : asset?.kind === "video" ? (asset.durationMs ?? 0) : 0;
}
