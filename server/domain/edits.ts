import { randomUUID } from "node:crypto";
import {
  defaultAutoZoom,
  defaultCanvas,
  type CursorEvent,
  type CameraLayout,
  type EditOperation,
  type Project,
  type Range,
  type TimelineSegment,
} from "@/shared/types.js";
import {
  duration,
  outputRanges,
  sliceSegments,
  sourceRanges,
  sourceTime,
  segmentDuration,
  segmentSourceDuration,
  subtractRanges,
} from "@/shared/timeline.js";
import { cameraLayoutSettings, sameCameraLayout } from "@/shared/camera.js";
import { AppError, operationsSchema } from "@/server/contracts/validation.js";
import { automaticZooms } from "@/server/domain/cursor.js";
export { outputRanges } from "@/shared/timeline.js";

function mergeRanges(ranges: Range[]): Range[] {
  const merged: Range[] = [];
  for (const r of ranges.filter((r) => r.endMs > r.startMs).sort((a, b) => a.startMs - b.startMs)) {
    const last = merged.at(-1);
    if (last && r.startMs <= last.endMs + 0.01) last.endMs = Math.max(last.endMs, r.endMs);
    else merged.push({ ...r });
  }
  return merged;
}
function checkedRange(project: Project, value: Range) {
  if (
    !(value.endMs > value.startMs) ||
    value.startMs < 0 ||
    value.endMs > duration(project.edits.segments) + 0.01
  )
    throw new AppError("INVALID_RANGE", "Choose a nonempty range inside the output timeline");
  return sourceRanges(project.edits.segments, value.startMs, value.endMs);
}
function sourceSpan(project: Project, value: Range): Range {
  const ranges = checkedRange(project, value);
  if (!ranges.length)
    throw new AppError("INVALID_RANGE", "Select recorded footage for this effect");
  if (ranges.some((range, index) => index > 0 && range.startMs < ranges[index - 1]!.endMs))
    throw new AppError(
      "INVALID_RANGE",
      "Apply this effect separately to reordered recording sections",
    );
  const span = { startMs: ranges[0]!.startMs, endMs: ranges.at(-1)!.endMs };
  const gaps = subtractRanges([span], ranges);
  if (
    project.edits.segments.some(
      (segment) =>
        !segment.assetId &&
        gaps.some((gap) => segment.startMs < gap.endMs && segment.endMs > gap.startMs),
    )
  )
    throw new AppError(
      "INVALID_RANGE",
      "Apply this effect separately to reordered recording sections",
    );
  return span;
}
function found<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((x) => x.id === id);
  if (!item) throw new AppError("NOT_FOUND", `Timeline item ${id} no longer exists`);
  return item;
}
function temporalPatch<T extends Range>(
  project: Project,
  target: T,
  patch: Partial<T>,
): Partial<T> {
  if (patch.startMs !== undefined || patch.endMs !== undefined) {
    const current = outputRanges(project.edits.segments, target);
    if (!current.length && (patch.startMs === undefined || patch.endMs === undefined))
      throw new AppError("INVALID_RANGE", "Supply both output times to move a hidden item");
    Object.assign(
      patch,
      sourceSpan(project, {
        startMs: patch.startMs ?? current[0]!.startMs,
        endMs: patch.endMs ?? current.at(-1)!.endMs,
      }),
    );
  }
  return patch;
}
function coalesceSegments(segments: TimelineSegment[]) {
  const result: TimelineSegment[] = [];
  for (const segment of segments) {
    const last = result.at(-1);
    if (
      last &&
      last.assetId === segment.assetId &&
      last.endMs === segment.startMs &&
      (last.speed ?? 1) === (segment.speed ?? 1)
    )
      last.endMs = segment.endMs;
    else result.push({ ...segment });
  }
  return result;
}
function insertSegments(project: Project, atMs: number, clips: TimelineSegment[]) {
  const segments = project.edits.segments,
    total = duration(segments);
  if (atMs > total)
    throw new AppError("INVALID_RANGE", "Insert inside the output timeline or at its end");
  if (!clips.length) return;
  project.edits.segments = [
    ...sliceSegments(segments, 0, atMs),
    ...clips,
    ...sliceSegments(segments, atMs, total),
  ];
}
export function applyEdits(project: Project, input: unknown, cursorEvents: CursorEvent[] = []) {
  const operations = operationsSchema.parse(input) as EditOperation[];
  for (const op of operations) {
    const edits = project.edits;
    switch (op.type) {
      case "cut": {
        checkedRange(project, op);
        const kept = [
          ...sliceSegments(edits.segments, 0, op.startMs),
          ...sliceSegments(edits.segments, op.endMs, duration(edits.segments)),
        ];
        if (duration(kept) < 1)
          throw new AppError("EMPTY_TIMELINE", "Keep at least one millisecond of video");
        edits.segments = kept;
        break;
      }
      case "trim":
        checkedRange(project, op);
        edits.segments = sliceSegments(edits.segments, op.startMs, op.endMs);
        break;
      case "speed": {
        checkedRange(project, op);
        const before = sliceSegments(edits.segments, 0, op.startMs);
        const changed = sliceSegments(edits.segments, op.startMs, op.endMs).map((r) => ({
          ...r,
          speed: op.speed,
        }));
        const after = sliceSegments(edits.segments, op.endMs, duration(edits.segments));
        edits.segments = [...before, ...changed, ...after];
        break;
      }
      case "split": {
        if (op.atMs <= 0 || op.atMs >= duration(edits.segments))
          throw new AppError("INVALID_RANGE", "Split point must be inside the output timeline");
        const sourceAtMs = sourceTime(edits.segments, op.atMs);
        edits.zooms = edits.zooms.flatMap((zoom) =>
          sourceAtMs > zoom.startMs &&
          sourceAtMs < zoom.endMs &&
          outputRanges(edits.segments, zoom).some(
            (range) => op.atMs > range.startMs && op.atMs < range.endMs,
          )
            ? [
                { ...zoom, endMs: sourceAtMs },
                { ...zoom, id: randomUUID(), startMs: sourceAtMs },
              ]
            : [zoom],
        );
        edits.segments = [
          ...sliceSegments(edits.segments, 0, op.atMs),
          ...sliceSegments(edits.segments, op.atMs, duration(edits.segments)),
        ];
        break;
      }
      case "clip.trim": {
        const segment = edits.segments[op.index];
        if (!segment) throw new AppError("NOT_FOUND", "Clip no longer exists");
        const lower = 0,
          upper = segmentSourceDuration(project, segment);
        if (
          op.sourceStartMs < lower ||
          op.sourceEndMs > upper ||
          op.sourceEndMs <= op.sourceStartMs
        )
          throw new AppError("INVALID_RANGE", "Clip bounds must stay inside its source media");
        edits.segments[op.index] = {
          ...segment,
          startMs: op.sourceStartMs,
          endMs: op.sourceEndMs,
        };
        break;
      }
      case "clip.merge": {
        const left = edits.segments[op.index],
          right = edits.segments[op.index + 1];
        if (!left || !right) throw new AppError("NOT_FOUND", "Choose a clip with a following clip");
        if (
          left.assetId !== right.assetId ||
          left.endMs !== right.startMs ||
          (left.speed ?? 1) !== (right.speed ?? 1)
        )
          throw new AppError(
            "INCOMPATIBLE_CLIPS",
            "Only source-contiguous clips with the same speed can be merged",
          );
        edits.segments.splice(op.index, 2, { ...left, endMs: right.endMs });
        break;
      }
      case "clip.move": {
        if (!edits.segments[op.index] || !edits.segments[op.toIndex])
          throw new AppError("NOT_FOUND", "Choose valid clip positions");
        const [clip] = edits.segments.splice(op.index, 1);
        edits.segments.splice(op.toIndex, 0, clip!);
        break;
      }
      case "clip.insert": {
        if (!project.source)
          throw new AppError("NO_RECORDING", "Record or import a video project first");
        const asset = project.assets.find((asset) => asset.id === op.assetId);
        if (!asset || !["video", "image"].includes(asset.kind))
          throw new AppError("INVALID_ASSET", "Import a video or image before inserting a clip");
        const clip = {
          assetId: asset.id,
          startMs: op.sourceStartMs ?? 0,
          endMs: op.sourceEndMs ?? (asset.kind === "image" ? 3000 : (asset.durationMs ?? 0)),
        };
        if (clip.endMs <= clip.startMs || clip.endMs > segmentSourceDuration(project, clip))
          throw new AppError(
            "INVALID_RANGE",
            "Choose a nonempty range inside the imported media (images up to 60 seconds)",
          );
        insertSegments(project, op.atMs, [clip]);
        break;
      }
      case "source.restore": {
        if (op.endMs <= op.startMs || op.endMs > (project.source?.durationMs ?? 0))
          throw new AppError(
            "INVALID_RANGE",
            "Restore a nonempty range inside the source recording",
          );
        const restored = subtractRanges(
          [{ startMs: op.startMs, endMs: op.endMs }],
          edits.segments.filter((segment) => !segment.assetId),
        );
        if (op.atMs !== undefined) insertSegments(project, op.atMs, restored);
        else
          for (const range of restored) {
            let atMs = 0;
            for (const segment of edits.segments) {
              if (!segment.assetId && segment.startMs >= range.endMs) break;
              atMs += segmentDuration(segment);
            }
            insertSegments(project, atMs, [range]);
          }
        edits.segments = coalesceSegments(edits.segments);
        break;
      }
      case "camera.update":
        Object.assign(edits.camera, op.settings);
        break;
      case "camera.hide": {
        const ranges = mergeRanges(checkedRange(project, op));
        edits.camera.hiddenRanges = op.hidden
          ? mergeRanges([...edits.camera.hiddenRanges, ...ranges])
          : subtractRanges(edits.camera.hiddenRanges, ranges);
        break;
      }
      case "camera.layout.set":
      case "camera.layout.remove": {
        const ranges = mergeRanges(checkedRange(project, op));
        const original = edits.camera.layouts;
        const layouts = subtractRanges(original, ranges);
        if (op.type === "camera.layout.set")
          for (const range of ranges) {
            const boundaries = [
              ...new Set([
                range.startMs,
                range.endMs,
                ...original.flatMap((layout) =>
                  [layout.startMs, layout.endMs].filter(
                    (time) => time > range.startMs && time < range.endMs,
                  ),
                ),
              ]),
            ].sort((a, b) => a - b);
            for (let i = 1; i < boundaries.length; i++) {
              const startMs = boundaries[i - 1]!,
                endMs = boundaries[i]!;
              const target =
                original.find((layout) => layout.startMs <= startMs && layout.endMs > startMs) ??
                edits.camera;
              layouts.push({
                ...cameraLayoutSettings(target),
                ...op.settings,
                id: randomUUID(),
                startMs,
                endMs,
              });
            }
          }
        const merged: CameraLayout[] = [],
          ids = new Set<string>();
        for (const layout of layouts.sort((a, b) => a.startMs - b.startMs)) {
          const last = merged.at(-1);
          if (last && last.endMs === layout.startMs && sameCameraLayout(last, layout))
            last.endMs = layout.endMs;
          else {
            const id = ids.has(layout.id) ? randomUUID() : layout.id;
            merged.push({ ...layout, id });
            ids.add(id);
          }
        }
        edits.camera.layouts = merged;
        break;
      }
      case "zoom.add":
        edits.zooms.push({
          ...op.zoom,
          ...sourceSpan(project, op.zoom),
          id: randomUUID(),
        });
        break;
      case "zoom.update": {
        const target = found(edits.zooms, op.id);
        Object.assign(target, temporalPatch(project, target, { ...op.zoom }));
        break;
      }
      case "zoom.remove":
        found(edits.zooms, op.id);
        edits.zooms = edits.zooms.filter((x) => x.id !== op.id);
        break;
      case "overlay.add": {
        if (
          op.overlay.kind === "image" &&
          !project.assets.some((a) => a.id === op.overlay.assetId && a.kind === "image")
        )
          throw new AppError("INVALID_ASSET", "Import an image before adding it to the video");
        if (op.overlay.kind === "text" && !op.overlay.text?.trim())
          throw new AppError("INVALID_INPUT", "Text overlay must contain text");
        edits.overlays.push({
          ...op.overlay,
          ...sourceSpan(project, op.overlay),
          id: randomUUID(),
        });
        break;
      }
      case "overlay.update": {
        const target = found(edits.overlays, op.id);
        const patch = temporalPatch(project, target, { ...op.overlay });
        const next = { ...target, ...patch };
        if (
          next.kind === "image" &&
          !project.assets.some((a) => a.id === next.assetId && a.kind === "image")
        )
          throw new AppError("INVALID_ASSET", "Image asset does not exist");
        if (next.kind === "text" && !next.text?.trim())
          throw new AppError("INVALID_INPUT", "Text overlay must contain text");
        Object.assign(target, next);
        break;
      }
      case "overlay.remove":
        found(edits.overlays, op.id);
        edits.overlays = edits.overlays.filter((x) => x.id !== op.id);
        break;
      case "audioClip.add":
      case "audioClip.update": {
        const clips = edits.audioClips ?? [];
        const next =
          op.type === "audioClip.add"
            ? { ...op.clip, id: randomUUID() }
            : { ...found(clips, op.id), ...op.clip };
        const asset = project.assets.find((a) => a.id === next.assetId && a.kind === "audio");
        if (!asset?.durationMs) throw new AppError("INVALID_ASSET", "Import an audio file first");
        if (
          op.type === "audioClip.add" ||
          op.clip.startMs !== undefined ||
          op.clip.endMs !== undefined
        )
          checkedRange(project, next);
        if (next.offsetMs + next.endMs - next.startMs > asset.durationMs + 0.01)
          throw new AppError("INVALID_RANGE", "Audio selection exceeds the imported file duration");
        edits.audioClips =
          op.type === "audioClip.add"
            ? [...clips, next]
            : clips.map((c) => (c.id === next.id ? next : c));
        break;
      }
      case "audioClip.remove":
        found(edits.audioClips ?? [], op.id);
        edits.audioClips = (edits.audioClips ?? []).filter((c) => c.id !== op.id);
        break;
      case "audio.update":
        Object.assign(edits.audio, op.settings);
        break;
      case "cursor.update":
        Object.assign(edits.cursor, op.settings);
        break;
      case "captions.update":
        Object.assign(edits.captions, op.settings);
        break;
      case "canvas.update": {
        const settings = {
          ...(edits.canvas ?? {
            ...defaultCanvas(),
            aspectRatio: "source" as const,
            background: "hidden" as const,
            padding: 0,
            radius: 0,
            shadow: 0,
          }),
          ...op.settings,
        };
        if (
          (settings.background === "image" || op.settings.assetId !== undefined) &&
          !project.assets.some((asset) => asset.id === settings.assetId && asset.kind === "image")
        )
          throw new AppError("INVALID_ASSET", "Import an image before using it as a background");
        edits.canvas = settings;
        break;
      }
      case "autoZoom.update":
        edits.autoZoom = {
          ...defaultAutoZoom(),
          ...edits.autoZoom,
          ...op.settings,
        };
        break;
      case "transcript.text":
        found(project.transcript, op.id).text = op.text;
        break;
      case "transcript.update":
        project.transcript = op.segments.map((s) => ({
          ...s,
          ...sourceSpan(project, s),
        }));
        break;
      case "zooms.auto": {
        const { type: _, ...overrides } = op;
        const settings = {
          ...defaultAutoZoom(),
          ...edits.autoZoom,
          ...overrides,
        };
        if (settings.enabled && !cursorEvents.length)
          throw new AppError(
            "NO_CURSOR_DATA",
            "This recording has no cursor activity metadata. Add zooms manually.",
          );
        edits.autoZoom = settings;
        edits.zooms = settings.enabled
          ? automaticZooms(edits.segments, cursorEvents, settings)
          : [];
        break;
      }
    }
  }
}

export type AudioWindow = Range & { db: number };
export function silenceCuts(
  project: Project,
  microphone: AudioWindow[],
  system: AudioWindow[],
  thresholdDb = -40,
  minSilenceMs = 700,
  paddingMs = 150,
): Range[] {
  // ponytail: RMS windows are a transparent silence heuristic; add VAD if noisy-room false negatives warrant it.
  const silent = mergeRanges(
    microphone
      .filter((w) => w.db <= thresholdDb)
      .map((w) => ({ startMs: w.startMs, endMs: w.endMs })),
  );
  const protectedAudio = mergeRanges(
    system
      .filter((w) => w.db > thresholdDb)
      .map((w) => ({
        startMs: Math.max(0, w.startMs - paddingMs),
        endMs: w.endMs + paddingMs,
      })),
  );
  const candidates = silent
    .filter((r) => r.endMs - r.startMs >= minSilenceMs)
    .map((r) => ({
      startMs: r.startMs + paddingMs,
      endMs: r.endMs - paddingMs,
    }))
    .filter((r) => r.endMs > r.startMs);
  return mergeRanges(
    subtractRanges(candidates, protectedAudio).flatMap((r) =>
      outputRanges(project.edits.segments, r),
    ),
  ).filter((r) => r.endMs - r.startMs >= 50);
}

export function subtitleText(project: Project, format: "srt" | "vtt") {
  const stamp = (timeMs: number) => {
    const ms = Math.round(timeMs);
    return `${Math.floor(ms / 3600000)
      .toString()
      .padStart(2, "0")}:${Math.floor((ms / 60000) % 60)
      .toString()
      .padStart(2, "0")}:${Math.floor((ms / 1000) % 60)
      .toString()
      .padStart(2, "0")}${format === "srt" ? "," : "."}${(ms % 1000).toString().padStart(3, "0")}`;
  };
  const cues = project.transcript
    .flatMap((segment) =>
      outputRanges(project.edits.segments, segment).map((r) => ({
        ...r,
        text: segment.text.replace(/-->/g, "→").trim(),
      })),
    )
    .sort((a, b) => a.startMs - b.startMs);
  return (
    (format === "vtt" ? "WEBVTT\n\n" : "") +
    cues
      .map(
        (cue, index) =>
          `${index + 1}\n${stamp(cue.startMs)} --> ${stamp(cue.endMs)}\n${cue.text}\n`,
      )
      .join("\n")
  );
}
