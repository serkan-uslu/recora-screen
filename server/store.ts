import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Project, ProjectSummary } from '../shared/types.js';
import { defaultEdits } from '../shared/types.js';
import { duration } from '../shared/timeline.js';
import { AppError, checkRevision, id as idSchema, projectSchema, sourceSchema } from './validation.js';

export const appDataDir = process.env.SCREENREC_DATA_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'Screen Recorder');
export const projectsDir = process.env.SCREENREC_PROJECTS_DIR || path.join(os.homedir(), 'Movies', 'Screen Recorder Projects');
export const socketPath = process.platform === 'win32' ? `\\\\.\\pipe\\screen-recorder-${os.userInfo().username}` : path.join(appDataDir, 'service.sock');

export async function atomicJSON(file: string, value: unknown) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const handle = await fs.open(temp, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value, null, 2)); await handle.sync(); } finally { await handle.close(); }
  try { await fs.rename(temp, file); } catch (error) { await fs.rm(temp, { force: true }); throw error; }
}

type Document = { project: Project; undo: Project[]; redo: Project[] };
export class ProjectStore extends EventEmitter {
  private locks = new Map<string, Promise<unknown>>();
  readonly busy = new Map<string, string>();
  private saveError?: Error;
  constructor(readonly root = projectsDir) { super(); }
  dir(id: string) { return path.join(this.root, idSchema.parse(id)); }
  async initialize() { await fs.mkdir(this.root, { recursive: true, mode: 0o700 }); }
  async exclusive<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    this.locks.set(id, next);
    try { return await next; } finally { if (this.locks.get(id) === next) this.locks.delete(id); }
  }
  async flush() { await Promise.all(this.locks.values()); if (this.saveError) throw this.saveError; }
  get saveFailure() { return this.saveError?.message; }
  assertIdle(id: string) { const reason = this.busy.get(id); if (reason) throw new AppError('PROJECT_BUSY', `Project is busy: ${reason}`); }
  async read(id: string): Promise<Document> {
    const dir = this.dir(id);
    try {
      const info = await fs.lstat(dir);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new AppError('INVALID_PROJECT', 'Project folder must not be a symbolic link');
    } catch (error: any) { if (error.code === 'ENOENT') throw new AppError('NOT_FOUND', 'Project not found'); throw error; }
    let recovered = false;
    let document: Document | undefined;
    for (const filename of ['project.json', 'project.backup.json']) {
      try {
        const file = path.join(dir, filename);
        if ((await fs.stat(file)).size > 50_000_000) throw new Error('Project manifest is too large');
        const data = JSON.parse(await fs.readFile(file, 'utf8'));
        const project = projectSchema.parse(data.project ?? data);
        if (project.id !== id) throw new Error('Project identifier does not match its folder');
        document = { project, undo: (data.undo ?? []).slice(-100).map((p: unknown) => projectSchema.parse(p)), redo: (data.redo ?? []).slice(-100).map((p: unknown) => projectSchema.parse(p)) };
        break;
      } catch { recovered = true; }
    }
    if (!document) throw new AppError('CORRUPT_PROJECT', 'Project and its backup cannot be read. Original media has been preserved.');
    if (recovered) document.project.recovered = true;
    if (document.project.status === 'recording' && !this.busy.has(id)) {
      try {
        document.project.source = sourceSchema.parse(JSON.parse(await fs.readFile(path.join(dir, 'recovered-source.json'), 'utf8')));
        document.project.edits.segments = [{ startMs: 0, endMs: document.project.source.durationMs }];
        document.project.status = 'ready';
      } catch { document.project.status = document.project.source ? 'ready' : 'draft'; }
      document.project.recovered = true;
    }
    return document;
  }
  async get(id: string): Promise<Project> { return structuredClone((await this.read(id)).project); }
  async persist(document: Document) {
    try { await this.persistDocument(document); this.saveError = undefined; }
    catch (error) { this.saveError = error instanceof Error ? error : new Error(String(error)); throw error; }
  }
  private async persistDocument(document: Document) {
    const dir = this.dir(document.project.id);
    const manifest = path.join(dir, 'project.json');
    // Bound snapshot storage by bytes as well as count so long transcripts do not multiply into gigabytes.
    let historyBytes = 0;
    for (const stack of [document.undo, document.redo]) {
      let keepFrom = stack.length;
      for (let i = stack.length - 1; i >= 0; i--) {
        const bytes = Buffer.byteLength(JSON.stringify(stack[i]));
        if (historyBytes + bytes > 16_000_000) break;
        historyBytes += bytes; keepFrom = i;
      }
      stack.splice(0, keepFrom);
    }
    // Backup the last valid committed document, never a partially written file.
    try {
      const existing = JSON.parse(await fs.readFile(manifest, 'utf8'));
      projectSchema.parse(existing.project ?? existing);
      await atomicJSON(path.join(dir, 'project.backup.json'), existing);
    } catch (error: any) { if (error.code && error.code !== 'ENOENT') throw error; }
    await atomicJSON(manifest, document);
    this.emit('changed', { projectId: document.project.id, revision: document.project.revision });
  }
  async create(name = 'Untitled recording'): Promise<Project> {
    if (!name.trim() || name.length > 200) throw new AppError('INVALID_INPUT', 'Project name must contain 1–200 characters');
    const now = new Date().toISOString();
    const project: Project = { schemaVersion: 1, id: randomUUID(), name: name.trim(), createdAt: now, updatedAt: now, revision: 0, status: 'draft', edits: defaultEdits(), transcript: [], assets: [] };
    await fs.mkdir(path.join(this.dir(project.id), 'media'), { recursive: true, mode: 0o700 });
    await this.persist({ project, undo: [], redo: [] });
    return project;
  }
  async list(): Promise<ProjectSummary[]> {
    await this.initialize();
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const rows: ProjectSummary[] = [];
    for (const e of entries.filter(e => e.isDirectory() && idSchema.safeParse(e.name).success)) {
      try {
        const p = await this.get(e.name);
        const thumbnail = path.join(this.dir(p.id), 'cache', 'thumbnail.png');
        rows.push({ id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt, revision: p.revision, status: p.status, durationMs: duration(p.edits.segments), path: this.dir(p.id), ...(await fs.stat(thumbnail).then(() => true, () => false) ? { thumbnail } : {}) });
      } catch { /* Damaged folders remain on disk for manual recovery. */ }
    }
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async mutate(id: string, expected: unknown, fn: (project: Project) => void | Promise<void>, history = true, allowBusy = false): Promise<Project> {
    return this.exclusive(id, async () => {
      if (!allowBusy) this.assertIdle(id);
      const doc = await this.read(id);
      checkRevision(doc.project.revision, expected);
      const before = structuredClone(doc.project);
      await fn(doc.project);
      doc.project.revision = before.revision + 1;
      doc.project.updatedAt = new Date().toISOString();
      projectSchema.parse(doc.project);
      if (history) {
        // ponytail: cap history at 100 whole-project snapshots; use deltas only if large projects make this costly.
        doc.undo = [...doc.undo, before].slice(-100);
        doc.redo = [];
      }
      await this.persist(doc);
      return structuredClone(doc.project);
    });
  }
  async history(id: string, expected: unknown, direction: 'undo' | 'redo'): Promise<Project> {
    return this.exclusive(id, async () => {
      this.assertIdle(id);
      const doc = await this.read(id);
      checkRevision(doc.project.revision, expected);
      const target = doc[direction].pop();
      if (!target) throw new AppError('HISTORY_EMPTY', `Nothing to ${direction}`);
      doc[direction === 'undo' ? 'redo' : 'undo'].push(structuredClone(doc.project));
      target.revision = doc.project.revision + 1;
      target.updatedAt = new Date().toISOString();
      doc.project = target;
      await this.persist(doc);
      return structuredClone(target);
    });
  }
  async resolveMedia(projectId: string, relative: string): Promise<string> {
    const base = await fs.realpath(this.dir(projectId));
    const target = await fs.realpath(path.join(base, relative));
    if (!target.startsWith(base + path.sep) || !(await fs.stat(target)).isFile()) throw new AppError('INVALID_PATH', 'Media must be a file inside this project');
    return target;
  }
  async copyMedia(projectId: string, input: string, relative: string): Promise<string> {
    if (!path.isAbsolute(input) || input.includes('\0')) throw new AppError('INVALID_PATH', 'Select an absolute file path');
    const source = await fs.realpath(input);
    if (!(await fs.stat(source)).isFile()) throw new AppError('INVALID_PATH', 'Select a regular file');
    const target = path.join(this.dir(projectId), relative);
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await fs.copyFile(source, target, constants.COPYFILE_EXCL);
    return relative;
  }
}
