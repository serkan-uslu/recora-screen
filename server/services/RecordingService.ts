import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError, errorOf, sourceSchema } from "@/server/contracts/validation.js";
import { cursorClicks } from "@/server/domain/cursor.js";
import { applyEdits } from "@/server/domain/edits.js";
import type { ProjectStore } from "@/server/infrastructure/ProjectStore.js";
import type { Jobs } from "@/server/services/Jobs.js";
import type { PreviewService } from "@/server/services/PreviewService.js";
import type { CommandParams, NativeCall } from "@/server/services/types.js";
import type { CursorEvent, Project, RecordingSource, RecordingStatus } from "@/shared/types.js";

const emptyRecording: RecordingStatus = {
  active: false,
  paused: false,
  durationMs: 0,
  microphoneLevel: 0,
  systemLevel: 0,
  cameraVisible: false,
  cameraEnabled: false,
};

export class RecordingService {
  private projectId?: string;
  private phase: RecordingStatus["phase"] = "idle";
  private finalization?: Promise<Project>;

  constructor(
    private readonly store: ProjectStore,
    private readonly jobs: Jobs,
    private readonly native: NativeCall,
    private readonly preview: PreviewService,
  ) {}

  get activeProjectId() {
    return this.projectId;
  }

  async status() {
    const observedId = this.projectId;
    const observedPhase = this.phase;
    try {
      const status = await this.native("recording.status", {});
      if (
        !status.active &&
        observedId &&
        observedId === this.projectId &&
        observedPhase === "recording" &&
        this.phase === "recording"
      )
        void this.finish(observedId).catch((error) =>
          console.error("Recording recovery:", errorOf(error).message),
        );
      return this.projectId
        ? {
            ...status,
            active: true,
            projectId: this.projectId,
            phase: ["starting", "finalizing"].includes(this.phase!) ? this.phase : status.phase,
          }
        : status;
    } catch (error) {
      return {
        ...emptyRecording,
        active: Boolean(this.projectId),
        projectId: this.projectId,
        error: errorOf(error).message,
      };
    }
  }

  async command(method: string, p: CommandParams): Promise<unknown> {
    switch (method) {
      case "recording.start":
        return this.start(p);
      case "recording.status":
        return this.status();
      case "recording.pause":
      case "recording.resume":
      case "recording.camera":
        if (!this.projectId) throw new AppError("NOT_RECORDING", "There is no active recording.");
        if (p.projectId && p.projectId !== this.projectId)
          throw new AppError("WRONG_PROJECT", "The recording belongs to another project.");
        return this.native(method, p);
      case "recording.stop":
        return this.stop(p);
      default:
        throw new AppError("UNKNOWN_METHOD", method);
    }
  }

  private async start(p: CommandParams) {
    if (this.projectId)
      throw new AppError("RECORDING_ACTIVE", "Another recording is already running.");
    const project = await this.store.get(p.projectId);
    if (project.source)
      throw new AppError(
        "PROJECT_HAS_SOURCE",
        "Create a new project for a new recording. Original media cannot be overwritten.",
      );
    if (this.jobs.active(project.id).length)
      throw new AppError("PROJECT_BUSY", "Project has running jobs.");
    const media = await fs.readdir(path.join(this.store.dir(project.id), "media"));
    if (media.length)
      throw new AppError(
        "RECOVERABLE_MEDIA",
        "This draft contains recording media. Create a new project to preserve the interrupted recording.",
      );
    this.projectId = project.id;
    this.phase = "starting";
    this.store.busy.set(project.id, "recording");
    try {
      await this.store.mutate(
        project.id,
        project.revision,
        (current) => {
          current.status = "recording";
          current.edits.camera.shape = p.settings.cameraShape;
        },
        false,
        true,
      );
      const result = await this.native("recording.start", {
        projectId: project.id,
        projectDir: this.store.dir(project.id),
        settings: p.settings,
      });
      this.phase = "recording";
      return result;
    } catch (error) {
      this.projectId = undefined;
      this.phase = "idle";
      this.store.busy.delete(project.id);
      const current = await this.store.get(project.id);
      await this.store
        .mutate(
          project.id,
          current.revision,
          (draft) => {
            draft.status = "draft";
          },
          false,
        )
        .catch(() => {});
      throw error;
    }
  }

  private async stop(p: CommandParams) {
    if (!this.projectId) throw new AppError("NOT_RECORDING", "There is no active recording.");
    const projectId = this.projectId;
    if (p.projectId && p.projectId !== projectId)
      throw new AppError("WRONG_PROJECT", "The recording belongs to another project.");
    try {
      this.phase = "finalizing";
      const result = await this.native("recording.stop", { projectId });
      return await this.finish(projectId, result.source ?? result);
    } catch (error) {
      const status = await this.native("recording.status", {}).catch(() => null);
      if (status && !status.active) await this.finish(projectId);
      else this.phase = "recording";
      throw error;
    }
  }

  private finish(projectId: string, suppliedSource?: unknown): Promise<Project> {
    if (this.finalization) return this.finalization;
    this.phase = "finalizing";
    const work = this.finalize(projectId, suppliedSource);
    this.finalization = work;
    void work
      .finally(() => {
        if (this.finalization === work) this.finalization = undefined;
      })
      .catch(() => {});
    return work;
  }

  private async finalize(projectId: string, suppliedSource?: unknown) {
    let source: RecordingSource | undefined;
    try {
      source = sourceSchema.parse(
        suppliedSource ??
          JSON.parse(
            await fs.readFile(
              path.join(this.store.dir(projectId), "recovered-source.json"),
              "utf8",
            ),
          ),
      );
    } catch {
      // Source media remains untouched so a later recovery can inspect it.
    }
    try {
      const current = await this.store.get(projectId);
      let events: CursorEvent[] = [];
      if (source?.cursor && (current.edits.autoZoom?.enabled ?? true)) {
        try {
          events = await cursorClicks(await this.store.resolveMedia(projectId, source.cursor));
        } catch (error) {
          console.error("Automatic zoom analysis skipped:", errorOf(error).message);
        }
      }
      const project = await this.store.mutate(
        projectId,
        current.revision,
        (draft) => {
          if (source) {
            draft.source = source;
            draft.status = "ready";
            draft.edits.segments = [{ startMs: 0, endMs: source.durationMs }];
          } else {
            draft.status = "draft";
            draft.recovered = true;
          }
          if (events.length)
            try {
              applyEdits(draft, [{ type: "zooms.auto" }], events);
            } catch (error) {
              console.error("Automatic zoom generation skipped:", errorOf(error).message);
            }
        },
        false,
        true,
      );
      return this.preview.refresh(await this.preview.thumbnail(project));
    } finally {
      this.projectId = undefined;
      this.phase = "idle";
      this.store.busy.delete(projectId);
    }
  }
}
