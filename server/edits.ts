import { randomUUID } from 'node:crypto';
import { defaultAutoZoom, defaultCanvas, type CursorEvent, type EditOperation, type Project, type Range, type TimelineSegment } from '../shared/types.js';
import { duration, outputRanges, sliceSegments, sourceRanges, sourceTime, subtractRanges, timelineTime } from '../shared/timeline.js';
import { AppError, operationsSchema } from './validation.js';
export { outputRanges } from '../shared/timeline.js';

export function mergeRanges(ranges: Range[]): Range[] {
  const merged: Range[] = [];
  for (const r of ranges.filter(r => r.endMs > r.startMs).sort((a, b) => a.startMs - b.startMs)) {
    const last = merged.at(-1);
    if (last && r.startMs <= last.endMs + 0.01) last.endMs = Math.max(last.endMs, r.endMs);
    else merged.push({ ...r });
  }
  return merged;
}
function checkedRange(project: Project, value: Range) {
  if (!(value.endMs > value.startMs) || value.startMs < 0 || value.endMs > duration(project.edits.segments) + 0.01) throw new AppError('INVALID_RANGE', 'Choose a nonempty range inside the output timeline');
  return sourceRanges(project.edits.segments, value.startMs, value.endMs);
}
function sourceSpan(project: Project, value: Range): Range {
  const ranges = checkedRange(project, value);
  return { startMs: ranges[0]!.startMs, endMs: ranges.at(-1)!.endMs };
}
function found<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find(x => x.id === id);
  if (!item) throw new AppError('NOT_FOUND', `Timeline item ${id} no longer exists`);
  return item;
}
function temporalPatch<T extends Range>(project: Project, target: T, patch: Partial<T>): Partial<T> {
  if (patch.startMs !== undefined || patch.endMs !== undefined) {
    const current = outputRanges(project.edits.segments, target);
    if (!current.length && (patch.startMs === undefined || patch.endMs === undefined)) throw new AppError('INVALID_RANGE', 'Supply both output times to move a hidden item');
    Object.assign(patch, sourceSpan(project, { startMs: patch.startMs ?? current[0]!.startMs, endMs: patch.endMs ?? current.at(-1)!.endMs }));
  }
  return patch;
}
function coalesceSegments(segments: TimelineSegment[]) {
  const result: TimelineSegment[] = [];
  for (const segment of segments) {
    const last = result.at(-1);
    if (last && last.endMs === segment.startMs && (last.speed ?? 1) === (segment.speed ?? 1)) last.endMs = segment.endMs;
    else result.push({ ...segment });
  }
  return result;
}
export function applyEdits(project: Project, input: unknown, cursorEvents: CursorEvent[] = []) {
  const operations = operationsSchema.parse(input) as EditOperation[];
  for (const op of operations) {
    const edits = project.edits;
    switch (op.type) {
      case 'cut': {
        const kept = subtractRanges(edits.segments, checkedRange(project, op));
        if (duration(kept) < 1) throw new AppError('EMPTY_TIMELINE', 'Keep at least one millisecond of video');
        edits.segments = kept; break;
      }
      case 'trim': checkedRange(project, op); edits.segments = sliceSegments(edits.segments, op.startMs, op.endMs); break;
      case 'speed': {
        checkedRange(project, op);
        const before = sliceSegments(edits.segments, 0, op.startMs);
        const changed = sliceSegments(edits.segments, op.startMs, op.endMs).map(r => ({ ...r, speed: op.speed }));
        const after = sliceSegments(edits.segments, op.endMs, duration(edits.segments));
        edits.segments = [...before, ...changed, ...after]; break;
      }
      case 'split': {
        if (op.atMs <= 0 || op.atMs >= duration(edits.segments)) throw new AppError('INVALID_RANGE', 'Split point must be inside the output timeline');
        const at = sourceTime(edits.segments, op.atMs);
        edits.segments = edits.segments.flatMap(r => at > r.startMs && at < r.endMs ? [{ ...r, endMs: at }, { ...r, startMs: at }] : [r]); break;
      }
      case 'clip.trim': {
        const segment = edits.segments[op.index];
        if (!segment) throw new AppError('NOT_FOUND', 'Clip no longer exists');
        const lower = edits.segments[op.index - 1]?.endMs ?? 0, upper = edits.segments[op.index + 1]?.startMs ?? project.source?.durationMs ?? 0;
        if (op.sourceStartMs < lower || op.sourceEndMs > upper || op.sourceEndMs <= op.sourceStartMs) throw new AppError('INVALID_RANGE', 'Source clip bounds must stay inside the recording without overlapping adjacent clips');
        edits.segments[op.index] = { ...segment, startMs: op.sourceStartMs, endMs: op.sourceEndMs }; break;
      }
      case 'clip.merge': {
        const left = edits.segments[op.index], right = edits.segments[op.index + 1];
        if (!left || !right) throw new AppError('NOT_FOUND', 'Choose a clip with a following clip');
        if (left.endMs !== right.startMs || (left.speed ?? 1) !== (right.speed ?? 1)) throw new AppError('INCOMPATIBLE_CLIPS', 'Only source-contiguous clips with the same speed can be merged');
        edits.segments.splice(op.index, 2, { ...left, endMs: right.endMs }); break;
      }
      case 'source.restore': {
        if (op.endMs <= op.startMs || op.endMs > (project.source?.durationMs ?? 0)) throw new AppError('INVALID_RANGE', 'Restore a nonempty range inside the source recording');
        const restored = subtractRanges([{ startMs: op.startMs, endMs: op.endMs }], edits.segments);
        edits.segments = coalesceSegments([...edits.segments, ...restored].sort((a, b) => a.startMs - b.startMs)); break;
      }
      case 'camera.update': Object.assign(edits.camera, op.settings); break;
      case 'camera.hide': {
        const ranges = checkedRange(project, op);
        edits.camera.hiddenRanges = op.hidden ? mergeRanges([...edits.camera.hiddenRanges, ...ranges]) : subtractRanges(edits.camera.hiddenRanges, ranges); break;
      }
      case 'zoom.add': edits.zooms.push({ ...op.zoom, ...sourceSpan(project, op.zoom), id: randomUUID() }); break;
      case 'zoom.update': {
        const target = found(edits.zooms, op.id);
        Object.assign(target, temporalPatch(project, target, { ...op.zoom })); break;
      }
      case 'zoom.remove': found(edits.zooms, op.id); edits.zooms = edits.zooms.filter(x => x.id !== op.id); break;
      case 'overlay.add': {
        if (op.overlay.kind === 'image' && !project.assets.some(a => a.id === op.overlay.assetId)) throw new AppError('INVALID_ASSET', 'Import an image before adding it to the video');
        if (op.overlay.kind === 'text' && !op.overlay.text?.trim()) throw new AppError('INVALID_INPUT', 'Text overlay must contain text');
        edits.overlays.push({ ...op.overlay, ...sourceSpan(project, op.overlay), id: randomUUID() }); break;
      }
      case 'overlay.update': {
        const target = found(edits.overlays, op.id);
        const patch = temporalPatch(project, target, { ...op.overlay });
        const next = { ...target, ...patch };
        if (next.kind === 'image' && !project.assets.some(a => a.id === next.assetId)) throw new AppError('INVALID_ASSET', 'Image asset does not exist');
        if (next.kind === 'text' && !next.text?.trim()) throw new AppError('INVALID_INPUT', 'Text overlay must contain text');
        Object.assign(target, next); break;
      }
      case 'overlay.remove': found(edits.overlays, op.id); edits.overlays = edits.overlays.filter(x => x.id !== op.id); break;
      case 'audio.update': Object.assign(edits.audio, op.settings); break;
      case 'cursor.update': Object.assign(edits.cursor, op.settings); break;
      case 'captions.update': Object.assign(edits.captions, op.settings); break;
      case 'canvas.update': {
        const settings = { ...(edits.canvas ?? { ...defaultCanvas(), aspectRatio: 'source' as const, background: 'hidden' as const, padding: 0, radius: 0, shadow: 0 }), ...op.settings };
        if ((settings.background === 'image' || op.settings.assetId !== undefined) && !project.assets.some(asset => asset.id === settings.assetId)) throw new AppError('INVALID_ASSET', 'Import an image before using it as a background');
        edits.canvas = settings; break;
      }
      case 'autoZoom.update': edits.autoZoom = { ...defaultAutoZoom(), ...edits.autoZoom, ...op.settings }; break;
      case 'transcript.text': found(project.transcript, op.id).text = op.text; break;
      case 'transcript.update': project.transcript = op.segments.map(s => ({ ...s, ...sourceSpan(project, s) })); break;
      case 'zooms.auto': {
        const { type: _, ...overrides } = op;
        const settings = { ...defaultAutoZoom(), ...edits.autoZoom, ...overrides };
        if (settings.enabled && !cursorEvents.length) throw new AppError('NO_CURSOR_DATA', 'This recording has no cursor activity metadata. Add zooms manually.');
        edits.autoZoom = settings;
        let until = -Infinity;
        edits.zooms = [];
        if (!settings.enabled) break;
        for (const event of cursorEvents.filter(e => e.click || e.kind).sort((a, b) => a.tMs - b.tMs)) {
          const output = timelineTime(edits.segments, event.tMs);
          if (output === null || output < until) continue;
          const endMs = Math.min(duration(edits.segments), output + settings.holdMs);
          if (endMs - output < 200) continue;
          edits.zooms.push({ id: randomUUID(), ...sourceSpan(project, { startMs: Math.max(0, output - settings.leadMs), endMs }), x: event.x, y: event.y, scale: settings.scale, motion: settings.motion, followCursor: settings.followCursor });
          until = endMs + settings.gapMs;
        }
        break;
      }
    }
  }
}

export type AudioWindow = Range & { db: number };
export function silenceCuts(project: Project, microphone: AudioWindow[], system: AudioWindow[], thresholdDb = -40, minSilenceMs = 700, paddingMs = 150): Range[] {
  // ponytail: RMS windows are a transparent silence heuristic; add VAD if noisy-room false negatives warrant it.
  const silent = mergeRanges(microphone.filter(w => w.db <= thresholdDb).map(w => ({ startMs: w.startMs, endMs: w.endMs })));
  const protectedAudio = mergeRanges(system.filter(w => w.db > thresholdDb).map(w => ({ startMs: Math.max(0, w.startMs - paddingMs), endMs: w.endMs + paddingMs })));
  const candidates = silent.filter(r => r.endMs - r.startMs >= minSilenceMs).map(r => ({ startMs: r.startMs + paddingMs, endMs: r.endMs - paddingMs })).filter(r => r.endMs > r.startMs);
  return mergeRanges(subtractRanges(candidates, protectedAudio).flatMap(r => outputRanges(project.edits.segments, r))).filter(r => r.endMs - r.startMs >= 50);
}

export function subtitleText(project: Project, format: 'srt' | 'vtt') {
  const stamp = (timeMs: number) => {
    const ms = Math.round(timeMs);
    return `${Math.floor(ms / 3600000).toString().padStart(2, '0')}:${Math.floor(ms / 60000 % 60).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}${format === 'srt' ? ',' : '.'}${(ms % 1000).toString().padStart(3, '0')}`;
  };
  const cues = project.transcript.flatMap(segment => outputRanges(project.edits.segments, segment).map(r => ({ ...r, text: segment.text.replace(/-->/g, '→').trim() }))).sort((a, b) => a.startMs - b.startMs);
  return (format === 'vtt' ? 'WEBVTT\n\n' : '') + cues.map((cue, index) => `${index + 1}\n${stamp(cue.startMs)} --> ${stamp(cue.endMs)}\n${cue.text}\n`).join('\n');
}
