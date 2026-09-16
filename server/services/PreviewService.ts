import { z } from "zod";
import { timelineMediaSchema, type TimelineMedia } from "@/shared/timelineMedia.js";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError, checkRevision, errorOf, projectSchema } from "@/server/contracts/validation.js";
import { cursorClicks } from "@/server/domain/cursor.js";
import { applyEdits } from "@/server/domain/edits.js";
import type { ProjectStore } from "@/server/infrastructure/ProjectStore.js";
import type { EditOperation, Project } from "@/shared/types.js";
import { duration } from "@/shared/timeline.js";
import type { CommandParams, NativeCall } from "@/server/services/types.js";

export class PreviewService {
  private projectId?: string;
  private sequence = -1;
  private readonly mediaCache = new Map<string, Promise<TimelineMedia>>();
  private mediaQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: ProjectStore,
    private readonly native: NativeCall,
    private readonly sourceProject: (projectId: string) => Promise<Project>,
  ) {}

  get activeProjectId() {
    return this.projectId;
  }

  async closeProject(projectId: string) {
    if (this.projectId !== projectId) return;
    await this.native("preview.pause", {}).catch(() => {});
    this.projectId = undefined;
  }

  async refresh(project: Project) {
    if (this.projectId === project.id && project.source)
      await this.native("preview.update", {
        project,
        projectDir: this.store.dir(project.id),
      }).catch((error) => console.error("Preview refresh failed:", errorOf(error).message));
    return project;
  }

  async thumbnail(project: Project) {
    if (!project.source) return project;
    const output = path.join(this.store.dir(project.id), "cache", "thumbnail.png");
    await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
    await this.native("preview.frame", {
      project,
      projectDir: this.store.dir(project.id),
      timeMs: Math.min(1000, duration(project.edits.segments) / 2),
      path: output,
    }).catch(() => {});
    return project;
  }

  private async timelineMedia(p: CommandParams): Promise<TimelineMedia> {
    const project = await this.sourceProject(p.projectId);
    const asset = p.assetId ? project.assets.find((asset) => asset.id === p.assetId) : undefined;
    if (p.assetId && !asset) throw new AppError("NOT_FOUND", "Timeline media was not found");
    const limit = asset
      ? asset.kind === "image"
        ? 60_000
        : asset.durationMs
      : project.source?.durationMs;
    if (!limit || p.endMs > limit + 1)
      throw new AppError("INVALID_RANGE", "Samples must stay inside the source media");
    const files: { kind: "microphone" | "system" | "asset"; path: string }[] = [];
    if (p.kind === "filmstrip") {
      if (asset?.kind === "audio") return { frames: [], channels: [] };
      files.push({ kind: "asset", path: asset?.path ?? project.source!.screen });
    } else if (asset) {
      if (asset.kind !== "image") files.push({ kind: "asset", path: asset.path });
    } else {
      if (project.source?.microphone)
        files.push({ kind: "microphone", path: project.source.microphone });
      if (project.source?.systemAudio)
        files.push({ kind: "system", path: project.source.systemAudio });
    }
    const resolved = await Promise.all(
      files.map(async (file) => {
        const absolute = await this.store.resolveMedia(project.id, file.path);
        const stat = await fs.stat(absolute);
        return { ...file, absolute, size: stat.size, modified: stat.mtimeMs };
      }),
    );
    const key = JSON.stringify([p.kind, p.startMs, p.endMs, resolved]);
    const cached = this.mediaCache.get(key);
    if (cached) return cached;
    // ponytail: serial sampling bounds native decoder work; use a small pool if visible-clip queue latency warrants it.
    const pending = this.mediaQueue.then(async () => {
      if (p.kind === "filmstrip") {
        const frames = await this.native("media.filmstrip", {
          path: resolved[0].absolute,
          image: asset?.kind === "image",
          startMs: p.startMs,
          endMs: p.endMs,
        });
        return timelineMediaSchema.parse({ frames, channels: [] });
      }
      const channels = [];
      for (const file of resolved) {
        const levels = z
          .array(z.number().finite().min(0).max(1))
          .max(256)
          .parse(
            await this.native("media.waveform", {
              path: file.absolute,
              startMs: p.startMs,
              endMs: p.endMs,
            }),
          );
        channels.push({ kind: file.kind, levels });
      }
      return timelineMediaSchema.parse({ frames: [], channels });
    });
    this.mediaQueue = pending.catch(() => {
      if (this.mediaCache.get(key) === pending) this.mediaCache.delete(key);
    });
    this.mediaCache.set(key, pending);
    if (this.mediaCache.size > 96) {
      const oldest = this.mediaCache.keys().next().value;
      if (oldest !== undefined) this.mediaCache.delete(oldest);
    }
    return pending;
  }

  async command(method: string, p: CommandParams): Promise<unknown> {
    switch (method) {
      case "preview.media":
        return this.timelineMedia(p);
      case "preview.reset":
      case "preview.draft": {
        const project = await this.store.get(p.projectId);
        checkRevision(project.revision, p.expectedRevision);
        this.store.assertIdle(project.id);
        if (this.projectId !== project.id)
          throw new AppError(
            "PREVIEW_NOT_ACTIVE",
            "Load this project in the preview before changing its draft",
          );
        if (p.sequence !== undefined && p.sequence < this.sequence) return { superseded: true };
        if (p.sequence !== undefined) this.sequence = p.sequence;
        const operations: EditOperation[] = method === "preview.reset" ? [] : p.operations;
        const events =
          operations.some((operation) => operation.type === "zooms.auto") && project.source?.cursor
            ? await cursorClicks(await this.store.resolveMedia(project.id, project.source.cursor))
            : [];
        const draft = structuredClone(project);
        if (operations.length) applyEdits(draft, operations, events);
        projectSchema.parse(draft);
        if (this.projectId !== project.id)
          throw new AppError("PREVIEW_NOT_ACTIVE", "The preview switched to another project");
        checkRevision((await this.store.get(project.id)).revision, p.expectedRevision);
        return this.native("preview.update", {
          project: draft,
          projectDir: this.store.dir(project.id),
          sequence: p.sequence,
          inputAtMs: p.inputAtMs,
        });
      }
      case "preview.load": {
        const project = await this.sourceProject(p.projectId);
        this.projectId = project.id;
        this.sequence = -1;
        return this.native(method, { project, projectDir: this.store.dir(project.id) });
      }
      case "preview.frame": {
        const project = await this.sourceProject(p.projectId);
        if (p.timeMs >= duration(project.edits.segments))
          throw new AppError("INVALID_RANGE", "Frame time is outside the output timeline.");
        const file = path.join(this.store.dir(project.id), "cache", `preview-${randomUUID()}.png`);
        await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        await this.native(method, {
          project,
          projectDir: this.store.dir(project.id),
          timeMs: p.timeMs,
          path: file,
        });
        return { path: file };
      }
      case "preview.metrics":
      case "preview.geometry":
      case "preview.selection":
      case "preview.bounds":
      case "preview.seek":
      case "preview.play":
      case "preview.pause":
      case "preview.status":
        return this.native(method, p);
      default:
        throw new AppError("UNKNOWN_METHOD", method);
    }
  }
}
