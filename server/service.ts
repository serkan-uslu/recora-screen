import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import type { CursorEvent, EditOperation, Project, RecordingStatus, RecordingSource } from '../shared/types.js';
import { duration } from '../shared/timeline.js';
import { ProjectStore, appDataDir, atomicJSON } from './store.js';
import { AppError, captureSchema, checkRevision, errorOf, finite, id, object, operationsSchema, projectSchema, sourceSchema, time } from './validation.js';
import { applyEdits, silenceCuts, subtitleText, type AudioWindow } from './edits.js';
import { Jobs } from './jobs.js';
import { cursorClicks } from './cursor.js';
import { LocalAI, assistant, defaultSettings, type AISettings } from './ai.js';

export type NativeCall = (method: string, params?: Record<string, unknown>) => Promise<any>;
const none = z.object({}).strict(), projectId = { projectId: id }, revision = { ...projectId, expectedRevision: finite.int().min(0) };
const absolutePath = z.string().min(1).max(4000).refine(p => path.isAbsolute(p) && !p.includes('\0'), 'An absolute file path is required');
const provider = z.enum(['openai', 'anthropic']);
const model = z.enum(['base', 'small']);
const settingsSchema = z.object({ provider, openaiModel: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/), anthropicModel: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/), transcriptionModel: model, language: z.string().regex(/^(auto|[a-z]{2,3})$/) }).strict();
const withProject = z.object(projectId).strict();
export const methodSchemas: Record<string, z.ZodType> = {
  'app.capabilities': none, 'app.canQuit': none, 'app.shutdown': none,
  'permissions.request': z.object({ kind: z.enum(['screen', 'camera', 'microphone', 'input']) }).strict(),
  'project.list': none, 'project.create': z.object({ name: z.string().min(1).max(200).optional() }).strict(), 'project.open': withProject, 'project.save': withProject,
  'project.rename': z.object({ ...revision, name: z.string().min(1).max(200) }).strict(), 'project.delete': z.object({ ...projectId, expectedRevision: finite.int().min(0).optional() }).strict(),
  'project.import': z.object({ path: absolutePath, name: z.string().min(1).max(200).optional() }).strict(),
  'recording.start': z.object({ ...projectId, settings: captureSchema }).strict(),
  'recording.pause': z.object({ projectId: id.optional() }).strict(), 'recording.resume': z.object({ projectId: id.optional() }).strict(), 'recording.stop': z.object({ projectId: id.optional() }).strict(), 'recording.status': none,
  'recording.camera': z.object({ visible: z.boolean().optional(), enabled: z.boolean().optional(), shape: z.enum(['circle','square']).optional() }).strict(),
  'timeline.apply': z.object({ ...revision, operations: operationsSchema }).strict(), 'history.undo': z.object(revision).strict(), 'history.redo': z.object(revision).strict(),
  'asset.import': z.object({ ...projectId, path: absolutePath, expectedRevision: finite.int().min(0).optional() }).strict(),
  'transcript.export': z.object({ ...projectId, format: z.enum(['srt','vtt']), path: absolutePath.optional() }).strict(),
  'ai.transcribe': z.object({ ...projectId, model: model.optional(), language: z.string().regex(/^(auto|[a-z]{2,3})$/).optional() }).strict(),
  'ai.cleanSilence': z.object({ ...projectId, thresholdDb: finite.min(-80).max(-10).optional(), minSilenceMs: finite.min(200).max(10000).optional(), paddingMs: finite.min(0).max(1000).optional(), preserveSystemAudio: z.boolean().optional(), apply: z.boolean().optional(), expectedRevision: finite.int().min(0).optional() }).strict(),
  'ai.assistant': z.object({ ...projectId, prompt: z.string().min(1).max(20000), provider: provider.optional() }).strict(),
  'ai.models/list': none, 'ai.models/download': z.object({ model }).strict(),
  'settings.get': none, 'settings.update': settingsSchema.partial(),
  'keychain.set': z.object({ provider, key: z.string().min(10).max(2000).refine(k => !/[\r\n]/.test(k), 'API key must be one line') }).strict(), 'keychain.delete': z.object({ provider }).strict(),
  'jobs.list': z.object({ projectId: id.optional() }).strict(), 'jobs.get': z.object({ jobId: id }).strict(), 'jobs.cancel': z.object({ jobId: id }).strict(),
  'preview.load': withProject, 'preview.bounds': z.object({ x: finite, y: finite, width: finite.min(0).max(16384), height: finite.min(0).max(16384) }).strict(),
  'preview.seek': z.object({ timeMs: time }).strict(), 'preview.play': none, 'preview.pause': none, 'preview.status': none,
  'preview.frame': z.object({ ...projectId, timeMs: time }).strict(),
  'export.start': z.object({ ...projectId, path: absolutePath, width: finite.int().min(320).max(3840).optional(), height: finite.int().min(240).max(2160).optional() }).strict(),
};
const emptyRecording: RecordingStatus = { active: false, paused: false, durationMs: 0, microphoneLevel: 0, systemLevel: 0, cameraVisible: false, cameraEnabled: false };
const readOnly = new Set(['app.capabilities','app.canQuit','project.list','project.open','settings.get','ai.models/list','jobs.list','jobs.get','preview.status']);
export const isReadOnly = (method: string) => readOnly.has(method);

export class ApplicationService extends EventEmitter {
  readonly store: ProjectStore;
  readonly jobs: Jobs;
  readonly localAI: LocalAI;
  private settings: AISettings = { ...defaultSettings };
  private native: NativeCall;
  private pending = new Map<string, { signature: string; result: Promise<unknown> }>();
  private mutationQueue: Promise<unknown> = Promise.resolve();
  private recordingId?: string;
  private exporting = new Set<string>();
  private previewId?: string;
  constructor(options: { projectsDir?: string; dataDir?: string; native?: NativeCall; whisper?: string } = {}) {
    super();
    this.dataDir = options.dataDir ?? appDataDir;
    this.store = new ProjectStore(options.projectsDir);
    this.store.on('changed', data => this.emit('project-changed', data));
    this.jobs = new Jobs(this.dataDir);
    this.localAI = new LocalAI(path.join(this.dataDir, 'models'), options.whisper);
    this.native = options.native ?? (async () => { throw new AppError('NATIVE_UNAVAILABLE', 'Open the macOS desktop app to use recording, playback, audio analysis, export and Keychain.'); });
  }
  readonly dataDir: string;
  async initialize() {
    await this.store.initialize(); await fs.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    try { this.settings = settingsSchema.parse(JSON.parse(await fs.readFile(path.join(this.dataDir, 'settings.json'), 'utf8'))); } catch (e: any) { if (e.code !== 'ENOENT') console.error('Using default settings:', e.message); }
    await this.jobs.initialize();
  }
  async flush() { await this.store.flush(); await this.jobs.flush(); }
  async command(method: string, input: unknown = {}): Promise<any> {
    const schema = methodSchemas[method];
    if (!schema) throw new AppError('UNKNOWN_METHOD', `Unknown command: ${method}`);
    const { requestId, ...raw } = object(input);
    const params = schema.parse(raw) as Record<string, any>;
    const execute = () => this.dispatch(method, params);
    if (!requestId) return this.serialize(method, execute);
    const requestKey = id.parse(requestId), signature = JSON.stringify({ method, params });
    const cached = this.pending.get(requestKey);
    if (cached) {
      if (cached.signature !== signature) throw new AppError('REQUEST_ID_CONFLICT', 'This requestId was already used for a different command');
      return structuredClone(await cached.result);
    }
    const result = this.serialize(method, execute);
    this.pending.set(requestKey, { signature, result });
    // ponytail: retain the latest 1000 retry receipts for this app session; durable receipts only if restart retries are introduced.
    if (this.pending.size > 1000) this.pending.delete(this.pending.keys().next().value!);
    return structuredClone(await result);
  }
  private serialize(method: string, action: () => Promise<unknown>) {
    if (isReadOnly(method) || method.startsWith('preview.')) return action();
    const result = this.mutationQueue.catch(() => {}).then(action);
    this.mutationQueue = result;
    return result;
  }
  private async refreshPreview(project: Project) {
    if (this.previewId === project.id && project.source) await this.native('preview.load', { project, projectDir: this.store.dir(project.id) }).catch(error => console.error('Preview refresh failed:', errorOf(error).message));
    return project;
  }
  private async thumbnail(project: Project) {
    if (!project.source) return project;
    const output = path.join(this.store.dir(project.id), 'cache', 'thumbnail.png');
    await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
    await this.native('preview.frame', { project, projectDir: this.store.dir(project.id), timeMs: Math.min(1000, duration(project.edits.segments) / 2), path: output }).catch(() => {});
    return project;
  }
  private async sourceProject(projectId: string) {
    let project = await this.store.get(projectId);
    this.store.assertIdle(projectId);
    if (!project.source) throw new AppError('NO_RECORDING', 'Record or import a video first');
    for (const file of [project.source.screen, project.source.camera, project.source.microphone, project.source.systemAudio, project.source.cursor, ...project.assets.map(a => a.path)].filter((x): x is string => !!x)) await this.store.resolveMedia(projectId, file);
    if (project.recovered) {
      const inspected = await this.native('media.inspect', { path: await this.store.resolveMedia(projectId, project.source.screen) });
      const readableMs = time.positive().parse(inspected.durationMs);
      if (readableMs < project.source.durationMs) {
        project = await this.store.mutate(projectId, project.revision, current => {
          const limit = readableMs;
          current.source!.durationMs = limit;
          const clip = <T extends { startMs: number; endMs: number }>(ranges: T[]) => ranges.map(r => ({ ...r, endMs: Math.min(r.endMs, limit) })).filter(r => r.endMs > r.startMs);
          current.edits.segments = clip(current.edits.segments);
          current.edits.camera.hiddenRanges = clip(current.edits.camera.hiddenRanges);
          current.edits.zooms = clip(current.edits.zooms); current.edits.overlays = clip(current.edits.overlays); current.transcript = clip(current.transcript);
          if (current.source!.cameraActiveRanges) current.source!.cameraActiveRanges = clip(current.source!.cameraActiveRanges!);
          if (!current.edits.segments.length) current.edits.segments = [{ startMs: 0, endMs: limit }];
        }, false);
      }
    }
    return project;
  }
  private async key(provider: string): Promise<string> {
    const result = await this.native('keychain.get', { provider });
    return typeof result === 'string' ? result : result?.key ?? '';
  }
  private async settingsResult() { return { ...this.settings, hasOpenaiKey: !!await this.key('openai').catch(() => ''), hasAnthropicKey: !!await this.key('anthropic').catch(() => '') }; }
  private async outputPath(file: string, extensions: string[]) {
    if (!extensions.includes(path.extname(file).toLowerCase())) throw new AppError('INVALID_PATH', `Output must use ${extensions.join(' or ')}`);
    const parent = await fs.realpath(path.dirname(file));
    const resolved = path.join(parent, path.basename(file));
    const root = await fs.realpath(this.store.root);
    if (resolved === root || resolved.startsWith(root + path.sep)) throw new AppError('INVALID_PATH', 'Export outside the original project folder to protect source media');
    if (await fs.lstat(resolved).then(() => true, () => false)) throw new AppError('FILE_EXISTS', 'The output file already exists. Choose a new filename.');
    return resolved;
  }
  private async timeline(params: Record<string, any>) {
    let events: CursorEvent[] = [];
    if ((params.operations as EditOperation[]).some(op => op.type === 'zooms.auto')) {
      const project = await this.store.get(params.projectId);
      if (project.source?.cursor) {
        const file = await this.store.resolveMedia(project.id, project.source.cursor);
        events = await cursorClicks(file);
      }
    }
    return this.refreshPreview(await this.store.mutate(params.projectId, params.expectedRevision, p => { applyEdits(p, params.operations, events); }));
  }
  private async analyzeSilence(project: Project, thresholdDb?: number, minSilenceMs?: number, paddingMs?: number, preserveSystemAudio = true) {
    if (!project.source?.microphone) throw new AppError('NO_MICROPHONE', 'Silence cleanup requires a separate microphone track.');
    const result = await this.native('audio.analyze', { project, projectDir: this.store.dir(project.id) });
    const window = z.object({ startMs: time, endMs: time, db: z.number().max(0) });
    const analysis = z.object({ microphone: z.array(window), system: z.array(window) }).parse(result);
    const ranges = silenceCuts(project, analysis.microphone as AudioWindow[], preserveSystemAudio ? analysis.system as AudioWindow[] : [], thresholdDb, minSilenceMs, paddingMs);
    const removedMs = duration(ranges);
    if (removedMs >= duration(project.edits.segments) - 1) throw new AppError('NO_SPEECH_DETECTED', 'The whole timeline appears silent. No cuts were applied. Check your microphone level.');
    const operations: EditOperation[] = [...ranges].reverse().map(r => ({ type: 'cut', ...r }));
    return { revision: project.revision, ranges, removedMs, operations };
  }
  private async finishRecording(projectId: string, suppliedSource?: unknown) {
    let source: RecordingSource | undefined;
    try { source = sourceSchema.parse(suppliedSource ?? JSON.parse(await fs.readFile(path.join(this.store.dir(projectId), 'recovered-source.json'), 'utf8'))); } catch { /* Preserve media even when metadata is incomplete. */ }
    try {
      const current = await this.store.get(projectId);
      const project = await this.store.mutate(projectId, current.revision, q => {
        if (source) { q.source = source; q.status = 'ready'; q.edits.segments = [{ startMs: 0, endMs: source.durationMs }]; }
        else { q.status = 'draft'; q.recovered = true; }
      }, false, true);
      return this.refreshPreview(await this.thumbnail(project));
    } finally { this.recordingId = undefined; this.store.busy.delete(projectId); }
  }
  private async dispatch(method: string, p: Record<string, any>): Promise<unknown> {
    switch (method) {
      case 'app.capabilities': {
        const resources = process.env.SCREENREC_RESOURCES;
        const mcp = resources ? { command: path.join(resources, 'bin', 'node'), args: [path.join(resources, 'mcp.mjs')], bundleId: 'com.screenrecorder.desktop' } : null;
        try { return { ...await this.native('capabilities', {}), nativeAvailable: true, mcp }; }
        catch (error) { return { nativeAvailable: false, platform: process.platform, permissions: { screen: false, camera: 'notDetermined', microphone: 'notDetermined', input: false }, sources: [], cameras: [], microphones: [], recording: emptyRecording, error: errorOf(error).message, mcp }; }
      }
      case 'app.canQuit': { const active = this.jobs.active(); return { canQuit: !this.recordingId && !active.length && !this.store.saveFailure, reason: this.store.saveFailure ?? (this.recordingId ? 'Stop the recording before closing.' : active.length ? 'Wait for running jobs or cancel them before closing.' : undefined) }; }
      case 'app.shutdown': {
        if (this.recordingId || this.jobs.active().length) throw new AppError('APP_BUSY', 'Stop the recording and finish or cancel running jobs before closing.');
        await this.flush(); return { ready: true };
      }
      case 'permissions.request': return this.native(method, p);
      case 'project.list': return this.store.list();
      case 'project.create': return this.store.create(p.name);
      case 'project.open': {
        return this.store.get(p.projectId);
      }
      case 'project.save': return this.store.exclusive(p.projectId, async () => {
        this.store.assertIdle(p.projectId);
        const document = await this.store.read(p.projectId);
        await this.store.persist(document);
        return structuredClone(document.project);
      });
      case 'project.rename': return this.store.mutate(p.projectId, p.expectedRevision, project => { project.name = p.name.trim(); });
      case 'project.delete': return this.store.exclusive(p.projectId, async () => {
        this.store.assertIdle(p.projectId);
        if (this.jobs.active(p.projectId).length) throw new AppError('PROJECT_BUSY', 'Cancel or finish project jobs before moving this project to Trash.');
        const project = await this.store.get(p.projectId);
        if (p.expectedRevision !== undefined) checkRevision(project.revision, p.expectedRevision);
        if (this.previewId === project.id) { await this.native('preview.pause', {}).catch(() => {}); this.previewId = undefined; }
        const result = await this.native('project.trash', { path: this.store.dir(project.id) });
        this.emit('project-changed', { projectId: project.id, deleted: true });
        return result;
      });
      case 'project.import': return this.importProject(p.path, p.name);
      case 'recording.start': {
        if (this.recordingId) throw new AppError('RECORDING_ACTIVE', 'Another recording is already running.');
        const project = await this.store.get(p.projectId);
        if (project.source) throw new AppError('PROJECT_HAS_SOURCE', 'Create a new project for a new recording. Original media cannot be overwritten.');
        if (this.jobs.active(project.id).length) throw new AppError('PROJECT_BUSY', 'Project has running jobs.');
        const media = await fs.readdir(path.join(this.store.dir(project.id), 'media'));
        if (media.length) throw new AppError('RECOVERABLE_MEDIA', 'This draft contains recording media. Create a new project to preserve the interrupted recording.');
        this.recordingId = project.id; this.store.busy.set(project.id, 'recording');
        try {
          await this.store.mutate(project.id, project.revision, current => { current.status = 'recording'; current.edits.camera.shape = p.settings.cameraShape; }, false, true);
          return await this.native(method, { projectId: project.id, projectDir: this.store.dir(project.id), settings: p.settings });
        } catch (error) {
          this.recordingId = undefined; this.store.busy.delete(project.id);
          const current = await this.store.get(project.id);
          await this.store.mutate(project.id, current.revision, q => { q.status = 'draft'; }, false).catch(() => {});
          throw error;
        }
      }
      case 'recording.status': {
        try {
          const status = await this.native(method, {});
          if (!status.active && this.recordingId) await this.finishRecording(this.recordingId);
          return status;
        } catch (error) { return { ...emptyRecording, active: !!this.recordingId, projectId: this.recordingId, error: errorOf(error).message }; }
      }
      case 'recording.pause': case 'recording.resume': case 'recording.camera': {
        if (!this.recordingId) throw new AppError('NOT_RECORDING', 'There is no active recording.');
        if (p.projectId && p.projectId !== this.recordingId) throw new AppError('WRONG_PROJECT', 'The recording belongs to another project.');
        return this.native(method, p);
      }
      case 'recording.stop': {
        if (!this.recordingId) throw new AppError('NOT_RECORDING', 'There is no active recording.');
        const projectId = this.recordingId;
        if (p.projectId && p.projectId !== projectId) throw new AppError('WRONG_PROJECT', 'The recording belongs to another project.');
        try {
          const result = await this.native(method, { projectId });
          return await this.finishRecording(projectId, result.source ?? result);
        } catch (error) {
          const status = await this.native('recording.status', {}).catch(() => null);
          if (status && !status.active) await this.finishRecording(projectId);
          throw error;
        }
      }
      case 'timeline.apply': return this.timeline(p);
      case 'history.undo': case 'history.redo': return this.refreshPreview(await this.store.history(p.projectId, p.expectedRevision, method.endsWith('undo') ? 'undo' : 'redo'));
      case 'asset.import': {
        this.store.assertIdle(p.projectId);
        const project = await this.store.get(p.projectId);
        if (p.expectedRevision !== undefined) checkRevision(project.revision, p.expectedRevision);
        const info = await fs.stat(p.path);
        if (!info.isFile() || info.size > 50_000_000) throw new AppError('INVALID_ASSET', 'Select a PNG, JPEG or WebP image smaller than 50 MB.');
        const handle = await fs.open(p.path, 'r'); const header = Buffer.alloc(16);
        try { await handle.read(header, 0, 16, 0); } finally { await handle.close(); }
        const extension = header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? '.png' : header[0] === 255 && header[1] === 216 ? '.jpg' : header.toString('ascii',0,4) === 'RIFF' && header.toString('ascii',8,12) === 'WEBP' ? '.webp' : '';
        if (!extension) throw new AppError('INVALID_ASSET', 'Only PNG, JPEG and WebP images are supported.');
        const assetId = randomUUID(), relative = `assets/${assetId}${extension}`;
        await this.store.copyMedia(project.id, p.path, relative);
        return this.store.mutate(project.id, project.revision, q => { q.assets.push({ id: assetId, name: path.basename(p.path).slice(0,200), path: relative, kind: 'image' }); });
      }
      case 'transcript.export': {
        const project = await this.store.get(p.projectId), text = subtitleText(project, p.format);
        if (p.path) { const output = await this.outputPath(p.path, [`.${p.format}`]); await fs.writeFile(output, text, { flag: 'wx', mode: 0o600 }); return { path: output, text }; }
        return { text };
      }
      case 'settings.get': return this.settingsResult();
      case 'settings.update': this.settings = settingsSchema.parse({ ...this.settings, ...p }); await atomicJSON(path.join(this.dataDir, 'settings.json'), this.settings); return this.settingsResult();
      case 'keychain.set': case 'keychain.delete': await this.native(method, p); return { ok: true };
      case 'ai.models/list': return this.localAI.list();
      case 'ai.models/download': {
        if (this.jobs.active().some(j => j.kind === 'model')) throw new AppError('MODEL_BUSY', 'A model download is already running.');
        return this.jobs.start('model', undefined, (signal, progress) => this.localAI.download(p.model, signal, progress));
      }
      case 'ai.transcribe': {
        const project = await this.sourceProject(p.projectId);
        if (!project.source?.microphone && !project.source?.systemAudio) throw new AppError('NO_AUDIO', 'This recording has no audio track to transcribe.');
        if (this.jobs.active(p.projectId).some(j => j.kind === 'transcribe')) throw new AppError('PROJECT_BUSY', 'This project is already being transcribed.');
        const model = p.model ?? this.settings.transcriptionModel, language = p.language ?? this.settings.language;
        return this.jobs.start('transcribe', project.id, async (signal, progress, jobId) => {
          const jobDir = path.join(this.store.dir(project.id), 'cache', jobId); await fs.mkdir(jobDir, { recursive: true, mode: 0o700 });
          const audioPath = path.join(jobDir, 'audio.wav');
          try {
            progress(0.02, 'Preparing audio');
            await this.native('audio.prepare', { projectDir: this.store.dir(project.id), source: project.source, path: audioPath });
            signal.throwIfAborted();
            const transcript = await this.localAI.transcribe(model, audioPath, path.join(jobDir, 'transcript'), language, signal, progress);
            signal.throwIfAborted();
            const result = await this.store.mutate(project.id, project.revision, q => { q.transcript = transcript.map(s => ({ ...s, endMs: Math.min(s.endMs, q.source!.durationMs) })).filter(s => s.endMs > s.startMs); q.edits.captions.enabled = true; });
            return this.refreshPreview(result);
          } finally { await fs.rm(audioPath, { force: true }); }
        });
      }
      case 'ai.cleanSilence': {
        const project = await this.sourceProject(p.projectId);
        if (!project.source?.microphone) throw new AppError('NO_MICROPHONE', 'Silence cleanup requires a separate microphone track.');
        if (p.expectedRevision !== undefined) checkRevision(project.revision, p.expectedRevision);
        return this.jobs.start('silence', project.id, async (signal, progress) => {
          progress(0.1, 'Measuring microphone and system audio');
          const result = await this.analyzeSilence(project, p.thresholdDb, p.minSilenceMs, p.paddingMs, p.preserveSystemAudio);
          signal.throwIfAborted();
          const { operations } = result;
          if (p.apply && operations.length) return this.timeline({ projectId: project.id, expectedRevision: project.revision, operations });
          return result;
        });
      }
      case 'ai.assistant': {
        const original = await this.sourceProject(p.projectId);
        const draft = structuredClone(original);
        const settings = { ...this.settings, ...(p.provider ? { provider: p.provider } : {}) }, apiKey = await this.key(settings.provider);
        if (!apiKey) throw new AppError('API_KEY_MISSING', `Add your ${settings.provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key in Settings first.`);
        return this.jobs.start('assistant', p.projectId, async (signal, progress) => {
          const result = await assistant(settings, apiKey, p.prompt, async () => structuredClone(draft), async input => {
            const args = methodSchemas['timeline.apply']!.parse({ ...input, projectId: draft.id }) as { expectedRevision: number; operations: EditOperation[] };
            checkRevision(draft.revision, args.expectedRevision);
            const next = structuredClone(draft);
            const clicks = args.operations.some(op => op.type === 'zooms.auto') && next.source?.cursor ? await cursorClicks(await this.store.resolveMedia(next.id, next.source.cursor)) : [];
            applyEdits(next, args.operations, clicks);
            projectSchema.parse(next);
            next.revision++;
            Object.assign(draft, next);
            return structuredClone(draft);
          }, signal, progress, () => this.analyzeSilence(draft));
          signal.throwIfAborted();
          if (draft.revision !== original.revision) result.project = await this.refreshPreview(await this.store.mutate(original.id, original.revision, project => { project.edits = draft.edits; project.transcript = draft.transcript; }));
          else result.project = await this.store.get(original.id);
          return result;
        });
      }
      case 'jobs.list': return this.jobs.list(p.projectId);
      case 'jobs.get': return this.jobs.get(p.jobId);
      case 'jobs.cancel': return this.jobs.cancel(p.jobId);
      case 'preview.load': {
        const project = await this.sourceProject(p.projectId); this.previewId = project.id;
        return this.native(method, { project, projectDir: this.store.dir(project.id) });
      }
      case 'preview.frame': {
        const project = await this.sourceProject(p.projectId);
        if (p.timeMs >= duration(project.edits.segments)) throw new AppError('INVALID_RANGE', 'Frame time is outside the output timeline.');
        const file = path.join(this.store.dir(project.id), 'cache', `preview-${randomUUID()}.png`); await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        await this.native(method, { project, projectDir: this.store.dir(project.id), timeMs: p.timeMs, path: file }); return { path: file };
      }
      case 'preview.bounds': case 'preview.seek': case 'preview.play': case 'preview.pause': case 'preview.status': return this.native(method, p);
      case 'export.start': {
        const project = await this.sourceProject(p.projectId), output = await this.outputPath(p.path, ['.mp4']);
        if (this.exporting.has(output)) throw new AppError('EXPORT_BUSY', 'Another export is using that filename.');
        const width = p.width ?? 1920, height = p.height ?? 1080;
        if (width % 2 || height % 2) throw new AppError('INVALID_INPUT', 'Video dimensions must be even numbers.');
        this.exporting.add(output);
        return this.jobs.start('export', project.id, async (signal, progress, jobId) => {
          try {
            signal.throwIfAborted();
            await this.native('export.start', { project, projectDir: this.store.dir(project.id), path: output, width, height, jobId });
            while (true) {
              signal.throwIfAborted();
              const status = await this.native('export.status', { jobId });
              progress(Number(status.progress) || 0, 'Rendering video');
              if (status.status === 'completed') { await fs.stat(output); return { path: output, revision: project.revision }; }
              if (status.status === 'failed') throw new AppError('EXPORT_FAILED', status.error ?? 'Native export failed.');
              if (status.status === 'cancelled') throw new AppError('CANCELLED', 'Export cancelled.');
              await delay(500, undefined, { signal });
            }
          } catch (error) { await this.native('export.cancel', { jobId }).catch(() => {}); throw error; }
          finally { this.exporting.delete(output); }
        });
      }
      default: throw new AppError('UNKNOWN_METHOD', method);
    }
  }
  private async importProject(inputPath: string, name?: string) {
    const info = await fs.stat(inputPath);
    if (!info.isDirectory() && path.extname(inputPath).toLowerCase() !== '.json') {
      const sourceInfo = await this.native('media.inspect', { path: inputPath });
      const source = sourceSchema.parse({ durationMs: sourceInfo.durationMs, width: sourceInfo.width, height: sourceInfo.height, fps: sourceInfo.fps, screen: `media/screen${path.extname(inputPath).toLowerCase()}`, ...(sourceInfo.hasAudio ? { microphone: `media/screen${path.extname(inputPath).toLowerCase()}` } : {}) });
      const project = await this.store.create(name ?? path.basename(inputPath, path.extname(inputPath)));
      await this.store.copyMedia(project.id, inputPath, source.screen);
      return this.thumbnail(await this.store.mutate(project.id, project.revision, q => { q.source = source; q.status = 'ready'; q.edits.segments = [{ startMs: 0, endMs: source.durationMs }]; }, false));
    }
    const sourceDir = await fs.realpath(info.isDirectory() ? inputPath : path.dirname(inputPath));
    const manifest = info.isDirectory() ? path.join(inputPath, 'project.json') : inputPath;
    if ((await fs.stat(manifest)).size > 50_000_000) throw new AppError('INVALID_PROJECT', 'Project manifest exceeds 50 MB.');
    const data = JSON.parse(await fs.readFile(manifest, 'utf8')), imported = projectSchema.parse(data.project ?? data);
    if (imported.status === 'recording') throw new AppError('PROJECT_BUSY', 'Finish the recording before importing this project.');
    const project = await this.store.create(name ?? `${imported.name} copy`);
    const copied = new Map<string, string>();
    const copy = async (relative: string) => {
      if (copied.has(relative)) return copied.get(relative)!;
      const full = await fs.realpath(path.join(sourceDir, relative));
      if (!full.startsWith(sourceDir + path.sep)) throw new AppError('INVALID_PATH', 'Imported media must stay inside the source project.');
      const destination = `media/${randomUUID()}${path.extname(relative)}`;
      await this.store.copyMedia(project.id, full, destination); copied.set(relative, destination); return destination;
    };
    const source = imported.source ? { ...imported.source } : undefined;
    if (source) for (const key of ['screen','camera','microphone','systemAudio','cursor'] as const) if (source[key]) source[key] = await copy(source[key]!);
    const assets = await Promise.all(imported.assets.map(async a => ({ ...a, path: await copy(a.path) })));
    return this.thumbnail(await this.store.mutate(project.id, project.revision, q => { q.source = source as RecordingSource | undefined; q.status = source ? 'ready' : 'draft'; q.edits = imported.edits; q.transcript = imported.transcript; q.assets = assets; }, false));
  }
}
