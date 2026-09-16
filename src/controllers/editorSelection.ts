import type { EditOperation, Project, Range, TimelineSegment } from "@/shared/types";
import { duration, outputRanges, segmentDuration } from "@/shared/timeline";

export type EditorTarget =
  | { kind: "clip"; index: number; source: string }
  | { kind: "camera"; range: Range; source: string; scope?: "selection" | "entire" }
  | { kind: "recordedAudio"; range: Range; source: string }
  | { kind: "zoom" | "overlay" | "audio"; id: string };

export const clipSource = (clip: TimelineSegment) =>
  `${clip.assetId ?? "screen"}:${clip.startMs}:${clip.endMs}`;
export const cameraSource = (project: Project) =>
  project.edits.segments.map((clip) => `${clipSource(clip)}:${clip.speed ?? 1}`).join("|");

export function targetRange(project: Project, target: EditorTarget): Range | null {
  if (target.kind === "clip") {
    const clip = project.edits.segments[target.index];
    if (!clip || clipSource(clip) !== target.source) return null;
    const startMs = duration(project.edits.segments.slice(0, target.index));
    return { startMs, endMs: startMs + segmentDuration(clip) };
  }
  if ("range" in target) return cameraSource(project) === target.source ? target.range : null;
  if (target.kind === "audio")
    return project.edits.audioClips?.find((clip) => clip.id === target.id) ?? null;
  const item = (target.kind === "zoom" ? project.edits.zooms : project.edits.overlays).find(
    (item) => item.id === target.id,
  );
  const ranges = item && outputRanges(project.edits.segments, item);
  return ranges?.length ? { startMs: ranges[0]!.startMs, endMs: ranges.at(-1)!.endMs } : null;
}

export function targetAfterEdit(
  target: EditorTarget | null,
  previous: Project,
  next: Project,
  operations: EditOperation[],
): EditorTarget | null {
  if (!target) return null;
  if (target.kind === "clip") {
    const range = targetRange(previous, target);
    if (!range) return null;
    let index = target.index;
    for (const operation of operations) {
      if (operation.type === "clip.move") {
        if (operation.index === index) index = operation.toIndex;
        else if (operation.index < index && operation.toIndex >= index) index -= 1;
        else if (operation.index > index && operation.toIndex <= index) index += 1;
      }
    }
    const ownTrim = operations.some(
      (operation) => operation.type === "clip.trim" && operation.index === target.index,
    );
    const ownSplit = operations.some(
      (operation) =>
        operation.type === "split" &&
        operation.atMs > range.startMs &&
        operation.atMs < range.endMs,
    );
    const clip = next.edits.segments[index];
    if (clip && (ownTrim || ownSplit || clipSource(clip) === target.source))
      return { ...target, index, source: clipSource(clip) };
    const matches = next.edits.segments.flatMap((clip, index) =>
      clipSource(clip) === target.source ? [index] : [],
    );
    if (matches.length === 1) return { ...target, index: matches[0]! };
    return null;
  }
  return targetRange(next, target) ? target : null;
}

export function previewCameraRange(
  project: Project,
  timeMs: number,
  selection: Range,
  scope: "selection" | "entire",
  keepSelection: boolean,
): Range | null {
  if (scope === "entire") return { startMs: 0, endMs: duration(project.edits.segments) };
  if (keepSelection && timeMs >= selection.startMs && timeMs < selection.endMs) return selection;
  let startMs = 0;
  for (const segment of project.edits.segments) {
    const endMs = startMs + segmentDuration(segment);
    if (timeMs >= startMs && timeMs < endMs) return segment.assetId ? null : { startMs, endMs };
    startMs = endMs;
  }
  return null;
}

export function targetPreviewTime(
  project: Project,
  target: EditorTarget,
  timeMs: number,
): number | null {
  if (target.kind === "zoom" || target.kind === "overlay") {
    const item = (target.kind === "zoom" ? project.edits.zooms : project.edits.overlays).find(
      (item) => item.id === target.id,
    );
    const ranges = item ? outputRanges(project.edits.segments, item) : [];
    const range =
      ranges.find((range) => timeMs >= range.startMs && timeMs < range.endMs) ?? ranges[0];
    return range ? (range.startMs + range.endMs) / 2 : null;
  }
  const range = targetRange(project, target);
  return range ? (range.startMs + range.endMs) / 2 : null;
}
