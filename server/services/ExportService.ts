import { promises as fs } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { AppError } from "@/server/contracts/validation.js";
import type { ProjectService } from "@/server/services/ProjectService.js";
import type { Jobs } from "@/server/services/Jobs.js";
import type { CommandParams, NativeCall } from "@/server/services/types.js";
import { outputSize, duration } from "@/shared/timeline.js";

export class ExportService {
  private readonly outputs = new Set<string>();

  constructor(
    private readonly projects: ProjectService,
    private readonly jobs: Jobs,
    private readonly native: NativeCall,
  ) {}

  async command(method: string, p: CommandParams): Promise<unknown> {
    if (method !== "export.start") throw new AppError("UNKNOWN_METHOD", method);
    const project = await this.projects.source(p.projectId);
    const format = p.format ?? "mp4";
    const output = await this.projects.outputPath(p.path, [format === "gif" ? ".gif" : ".mp4"]);
    if (this.outputs.has(output))
      throw new AppError("EXPORT_BUSY", "Another export is using that filename.");
    const { width, height } =
      p.width === undefined
        ? outputSize(project, p.quality ?? (format === "gif" ? "720" : "1080"))
        : { width: p.width, height: p.height };
    if (width % 2 || height % 2)
      throw new AppError("INVALID_INPUT", "Video dimensions must be even numbers.");
    if (
      format === "gif" &&
      (width > 1280 || height > 1280 || duration(project.edits.segments) > 60000)
    )
      throw new AppError(
        "GIF_LIMIT",
        "GIF supports up to 60 seconds and 1280 pixels per axis. Trim the video or choose MP4.",
      );
    this.outputs.add(output);
    return this.jobs.start("export", project.id, async (signal, progress, jobId) => {
      try {
        signal.throwIfAborted();
        await this.native("export.start", {
          project,
          projectDir: this.projects.store.dir(project.id),
          path: output,
          width,
          height,
          jobId,
          format,
          gifFps: p.gifFps ?? 15,
          loop: p.loop ?? true,
        });
        while (true) {
          signal.throwIfAborted();
          const status = await this.native("export.status", { jobId });
          progress(Number(status.progress) || 0, "Rendering video");
          if (status.status === "completed") {
            await fs.stat(output);
            return { path: output, revision: project.revision };
          }
          if (status.status === "failed")
            throw new AppError("EXPORT_FAILED", status.error ?? "Native export failed.");
          if (status.status === "cancelled") throw new AppError("CANCELLED", "Export cancelled.");
          await delay(500, undefined, { signal });
        }
      } catch (error) {
        await this.native("export.cancel", { jobId }).catch(() => {});
        throw error;
      } finally {
        this.outputs.delete(output);
      }
    });
  }
}
