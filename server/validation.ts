import { z } from 'zod';
import type { RpcError } from '../shared/types.js';

export class AppError extends Error {
  constructor(public code: string, message: string, public details?: unknown) { super(message); }
}
export function errorOf(error: unknown): RpcError {
  if (error instanceof AppError) return { code: error.code, message: error.message, details: error.details };
  if (error instanceof z.ZodError) return { code: 'INVALID_INPUT', message: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') };
  return { code: 'FAILED', message: error instanceof Error ? error.message : 'Operation failed' };
}
export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const finite = z.number().finite();
export const time = finite.min(0).max(Number.MAX_SAFE_INTEGER);
export const unit = finite.min(0).max(1);
export const color = z.string().regex(/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/);
export const rangeShape = { startMs: time, endMs: time };
export const range = z.object(rangeShape).strict().refine(r => r.endMs > r.startMs, 'End must be after start');
export const camera = z.object({ visible: z.boolean(), shape: z.enum(['circle', 'square']), x: unit, y: unit, size: finite.min(0.05).max(0.8), shadow: z.boolean(), hiddenRanges: z.array(range).max(10000) }).strict();
export const zoom = z.object({ ...rangeShape, id, scale: finite.min(1).max(4), x: unit, y: unit }).strict();
export const overlay = z.object({ ...rangeShape, id, kind: z.enum(['text', 'image']), text: z.string().max(10000).optional(), assetId: id.optional(), x: unit, y: unit, width: finite.min(0.02).max(1), fontSize: finite.min(8).max(200), color, animation: z.enum(['none', 'fade', 'slide']) }).strict();
export const audio = z.object({ microphoneVolume: finite.min(0).max(3), systemVolume: finite.min(0).max(3) }).strict();
export const cursor = z.object({ visible: z.boolean(), highlight: z.boolean(), smooth: z.boolean(), size: finite.min(0.5).max(4) }).strict();
export const captions = z.object({ enabled: z.boolean(), fontSize: finite.min(8).max(200), color, background: color }).strict();
export const transcript = z.array(z.object({ ...rangeShape, id, text: z.string().max(10000) }).strict()).max(100000);
export const editState = z.object({ segments: z.array(range).max(10000), camera, zooms: z.array(zoom).max(10000), overlays: z.array(overlay).max(10000), audio, cursor, captions }).strict();
export const relativeFile = z.string().min(1).max(500).refine(p => !p.startsWith('/') && !p.includes('\\') && !p.split('/').some(s => !s || s === '..' || s === '.') && !p.includes('\0') && !/^[A-Za-z]:/.test(p), 'Must be a safe relative project path');
export const sourceSchema = z.object({ durationMs: time.positive(), width: finite.int().min(16).max(16384), height: finite.int().min(16).max(16384), fps: finite.min(1).max(240), screen: relativeFile, camera: relativeFile.optional(), microphone: relativeFile.optional(), systemAudio: relativeFile.optional(), cursor: relativeFile.optional(), cameraActiveRanges: z.array(range).optional() }).strict();
export const projectSchema = z.object({ schemaVersion: z.literal(1), id, name: z.string().min(1).max(200), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), revision: finite.int().min(0), status: z.enum(['draft', 'recording', 'ready']), source: sourceSchema.optional(), edits: editState, transcript, assets: z.array(z.object({ id, name: z.string().max(200), path: relativeFile, kind: z.literal('image') }).strict()).max(1000), recovered: z.boolean().optional() }).strict();
export const captureSchema = z.object({ sourceId: z.string().min(1).max(200), sourceKind: z.enum(['display', 'window']), region: z.object({ x: finite.min(0), y: finite.min(0), width: finite.positive().max(16384), height: finite.positive().max(16384) }).strict().optional(), cameraId: z.string().max(300).optional(), microphoneId: z.string().max(300).optional(), systemAudio: z.boolean(), cameraShape: z.enum(['circle', 'square']), width: finite.int().min(16).max(7680), height: finite.int().min(16).max(4320), fps: z.literal(30) }).strict();
export const operationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cut'), ...rangeShape }).strict(), z.object({ type: z.literal('trim'), ...rangeShape }).strict(), z.object({ type: z.literal('split'), atMs: time }).strict(),
  z.object({ type: z.literal('camera.update'), settings: camera.omit({ hiddenRanges: true }).partial() }).strict(),
  z.object({ type: z.literal('camera.hide'), hidden: z.boolean(), ...rangeShape }).strict(),
  z.object({ type: z.literal('zoom.add'), zoom: zoom.omit({ id: true }) }).strict(), z.object({ type: z.literal('zoom.remove'), id }).strict(),
  z.object({ type: z.literal('overlay.add'), overlay: overlay.omit({ id: true }) }).strict(), z.object({ type: z.literal('overlay.update'), id, overlay: overlay.omit({ id: true }).partial() }).strict(), z.object({ type: z.literal('overlay.remove'), id }).strict(),
  z.object({ type: z.literal('audio.update'), settings: audio.partial() }).strict(), z.object({ type: z.literal('cursor.update'), settings: cursor.partial() }).strict(), z.object({ type: z.literal('captions.update'), settings: captions.partial() }).strict(),
  z.object({ type: z.literal('transcript.update'), segments: transcript }).strict(), z.object({ type: z.literal('zooms.auto'), scale: finite.min(1).max(4).optional() }).strict(),
]);
export const operationsSchema = z.array(operationSchema).min(1).max(1000);
export function object(value: unknown): Record<string, unknown> { return z.record(z.string(), z.unknown()).parse(value ?? {}); }
export function checkRevision(actual: number, expected: unknown) {
  const revision = finite.int().min(0).parse(expected);
  if (actual !== revision) throw new AppError('REVISION_CONFLICT', 'The project changed. Reload it before editing.', { expectedRevision: revision, revision: actual });
}
