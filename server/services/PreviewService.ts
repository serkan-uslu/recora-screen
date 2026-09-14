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

  async command(method: string, p: CommandParams): Promise<unknown> {
    switch (method) {
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
