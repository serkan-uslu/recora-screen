import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AppError,
  checkRevision,
  parseProject,
  sourceSchema,
  time,
} from "@/server/contracts/validation.js";
import type { ProjectStore } from "@/server/infrastructure/ProjectStore.js";
import type { Jobs } from "@/server/services/Jobs.js";
import type { PreviewService } from "@/server/services/PreviewService.js";
import type { CommandParams, NativeCall } from "@/server/services/types.js";
import type { RecordingSource } from "@/shared/types.js";

export class ProjectService {
  constructor(
    readonly store: ProjectStore,
    private readonly jobs: Jobs,
    private readonly native: NativeCall,
    private readonly preview: PreviewService,
    private readonly changed: (data: { projectId: string; deleted: true }) => void,
  ) {}

  async source(projectId: string) {
    let project = await this.store.get(projectId);
    this.store.assertIdle(projectId);
    if (!project.source) throw new AppError("NO_RECORDING", "Record or import a video first");
    for (const file of [
      project.source.screen,
      project.source.camera,
      project.source.microphone,
      project.source.systemAudio,
      project.source.cursor,
      ...project.assets.map((asset) => asset.path),
    ].filter((value): value is string => Boolean(value)))
      await this.store.resolveMedia(projectId, file);
    if (project.recovered) {
      const inspected = await this.native("media.inspect", {
        path: await this.store.resolveMedia(projectId, project.source.screen),
      });
      const readableMs = time.positive().parse(inspected.durationMs);
      if (readableMs < project.source.durationMs) {
        project = await this.store.mutate(
          projectId,
          project.revision,
          (current) => {
            const limit = readableMs;
            current.source!.durationMs = limit;
            const clip = <T extends { startMs: number; endMs: number }>(ranges: T[]) =>
              ranges
                .map((range) => ({ ...range, endMs: Math.min(range.endMs, limit) }))
                .filter((range) => range.endMs > range.startMs);
            current.edits.segments = clip(current.edits.segments);
            current.edits.camera.hiddenRanges = clip(current.edits.camera.hiddenRanges);
            current.edits.camera.layouts = clip(current.edits.camera.layouts);
            current.edits.zooms = clip(current.edits.zooms);
            current.edits.overlays = clip(current.edits.overlays);
            current.transcript = clip(current.transcript);
            if (current.source!.cameraActiveRanges)
              current.source!.cameraActiveRanges = clip(current.source!.cameraActiveRanges);
            if (!current.edits.segments.length)
              current.edits.segments = [{ startMs: 0, endMs: limit }];
          },
          false,
        );
      }
    }
    return project;
  }

  async outputPath(file: string, extensions: string[]) {
    if (!extensions.includes(path.extname(file).toLowerCase()))
      throw new AppError("INVALID_PATH", `Output must use ${extensions.join(" or ")}`);
    const parent = await fs.realpath(path.dirname(file));
    const resolved = path.join(parent, path.basename(file));
    const root = await fs.realpath(this.store.root);
    if (resolved === root || resolved.startsWith(root + path.sep))
      throw new AppError(
        "INVALID_PATH",
        "Export outside the original project folder to protect source media",
      );
    if (
      await fs.lstat(resolved).then(
        () => true,
        () => false,
      )
    )
      throw new AppError("FILE_EXISTS", "The output file already exists. Choose a new filename.");
    return resolved;
  }

  async command(method: string, p: CommandParams): Promise<unknown> {
    switch (method) {
      case "project.list":
        return this.store.list();
      case "project.create":
        return this.store.create(p.name);
      case "project.open":
        return this.store.get(p.projectId);
      case "project.save":
        return this.store.exclusive(p.projectId, async () => {
          this.store.assertIdle(p.projectId);
          const document = await this.store.read(p.projectId);
          await this.store.persist(document);
          return structuredClone(document.project);
        });
      case "project.rename":
        return this.store.mutate(p.projectId, p.expectedRevision, (project) => {
          project.name = p.name.trim();
        });
      case "project.delete":
        return this.store.exclusive(p.projectId, async () => {
          this.store.assertIdle(p.projectId);
          if (this.jobs.active(p.projectId).length)
            throw new AppError(
              "PROJECT_BUSY",
              "Cancel or finish project jobs before moving this project to Trash.",
            );
          const project = await this.store.get(p.projectId);
          if (p.expectedRevision !== undefined) checkRevision(project.revision, p.expectedRevision);
          await this.preview.closeProject(project.id);
          const result = await this.native("project.trash", { path: this.store.dir(project.id) });
          this.changed({ projectId: project.id, deleted: true });
          return result;
        });
      case "project.import":
        return this.importProject(p.path, p.name);
      default:
        throw new AppError("UNKNOWN_METHOD", method);
    }
  }

  private async importProject(inputPath: string, name?: string) {
    const inputInfo = await fs.lstat(inputPath);
    if (inputInfo.isSymbolicLink())
      throw new AppError("INVALID_PATH", "Symbolic links cannot be imported");
    const info = await fs.stat(inputPath);
    if (!info.isDirectory() && path.extname(inputPath).toLowerCase() !== ".json") {
      const sourceInfo = await this.native("media.inspect", { path: inputPath });
      const source = sourceSchema.parse({
        durationMs: sourceInfo.durationMs,
        width: sourceInfo.width,
        height: sourceInfo.height,
        fps: sourceInfo.fps,
        screen: `media/screen${path.extname(inputPath).toLowerCase()}`,
        ...(sourceInfo.hasAudio
          ? { microphone: `media/screen${path.extname(inputPath).toLowerCase()}` }
          : {}),
      });
      const project = await this.store.create(
        name ?? path.basename(inputPath, path.extname(inputPath)),
      );
      await this.store.copyMedia(project.id, inputPath, source.screen);
      return this.preview.thumbnail(
        await this.store.mutate(
          project.id,
          project.revision,
          (current) => {
            current.source = source;
            current.status = "ready";
            current.edits.segments = [{ startMs: 0, endMs: source.durationMs }];
          },
          false,
        ),
      );
    }
    const sourceDir = await fs.realpath(info.isDirectory() ? inputPath : path.dirname(inputPath));
    const manifest = info.isDirectory() ? path.join(inputPath, "project.json") : inputPath;
    if ((await fs.lstat(manifest)).isSymbolicLink())
      throw new AppError("INVALID_PATH", "Symbolic links cannot be imported");
    if ((await fs.stat(manifest)).size > 50_000_000)
      throw new AppError("INVALID_PROJECT", "Project manifest exceeds 50 MB.");
    const data: unknown = JSON.parse(await fs.readFile(manifest, "utf8"));
    const imported = parseProject(
      typeof data === "object" && data !== null && "project" in data
        ? (data as { project: unknown }).project
        : data,
    );
    if (imported.status === "recording")
      throw new AppError("PROJECT_BUSY", "Finish the recording before importing this project.");
    const project = await this.store.create(name ?? `${imported.name} copy`);
    const copied = new Map<string, string>();
    const copy = async (relative: string) => {
      const existing = copied.get(relative);
      if (existing) return existing;
      const unresolved = path.join(sourceDir, relative);
      if ((await fs.lstat(unresolved)).isSymbolicLink())
        throw new AppError("INVALID_PATH", "Symbolic links cannot be imported");
      const full = await fs.realpath(unresolved);
      if (!full.startsWith(sourceDir + path.sep))
        throw new AppError("INVALID_PATH", "Imported media must stay inside the source project.");
      const destination = `media/${randomUUID()}${path.extname(relative)}`;
      await this.store.copyMedia(project.id, full, destination);
      copied.set(relative, destination);
      return destination;
    };
    const source = imported.source ? { ...imported.source } : undefined;
    if (source)
      for (const key of ["screen", "camera", "microphone", "systemAudio", "cursor"] as const)
        if (source[key]) source[key] = await copy(source[key]);
    const assets = await Promise.all(
      imported.assets.map(async (asset) => ({ ...asset, path: await copy(asset.path) })),
    );
    return this.preview.thumbnail(
      await this.store.mutate(
        project.id,
        project.revision,
        (current) => {
          current.source = source as RecordingSource | undefined;
          current.status = source ? "ready" : "draft";
          current.edits = imported.edits;
          current.transcript = imported.transcript;
          current.assets = assets;
        },
        false,
      ),
    );
  }
}
