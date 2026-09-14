import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AppError, checkRevision, time } from "@/server/contracts/validation.js";
import { silenceCuts, subtitleText, type AudioWindow } from "@/server/domain/edits.js";
import type { EditingService } from "@/server/services/EditingService.js";
import type { Jobs } from "@/server/services/Jobs.js";
import type { PreviewService } from "@/server/services/PreviewService.js";
import type { ProjectService } from "@/server/services/ProjectService.js";
import type { LocalAI, AISettings } from "@/server/services/ai.js";
import type { CommandParams, NativeCall } from "@/server/services/types.js";
import type { EditOperation, Project } from "@/shared/types.js";
import { duration } from "@/shared/timeline.js";

export class TranscriptionService {
  constructor(
    private readonly projects: ProjectService,
    private readonly editing: EditingService,
    private readonly preview: PreviewService,
    private readonly jobs: Jobs,
    private readonly localAI: LocalAI,
    private readonly native: NativeCall,
    private readonly settings: () => AISettings,
  ) {}

  async analyzeSilence(
    project: Project,
    thresholdDb?: number,
    minSilenceMs?: number,
    paddingMs?: number,
    preserveSystemAudio = true,
  ) {
    if (!project.source?.microphone)
      throw new AppError("NO_MICROPHONE", "Silence cleanup requires a separate microphone track.");
    const result = await this.native("audio.analyze", {
      project,
      projectDir: this.projects.store.dir(project.id),
    });
    const window = z.object({ startMs: time, endMs: time, db: z.number().max(0) });
    const analysis = z
      .object({ microphone: z.array(window), system: z.array(window) })
      .parse(result);
    const ranges = silenceCuts(
      project,
      analysis.microphone as AudioWindow[],
      preserveSystemAudio ? (analysis.system as AudioWindow[]) : [],
      thresholdDb,
      minSilenceMs,
      paddingMs,
    );
    const removedMs = duration(ranges);
    if (removedMs >= duration(project.edits.segments) - 1)
      throw new AppError(
        "NO_SPEECH_DETECTED",
        "The whole timeline appears silent. No cuts were applied. Check your microphone level.",
      );
    const operations: EditOperation[] = [...ranges]
      .reverse()
      .map((range) => ({ type: "cut", ...range }));
    return { revision: project.revision, ranges, removedMs, operations };
  }

  async command(method: string, p: CommandParams): Promise<unknown> {
    switch (method) {
      case "transcript.export": {
        const project = await this.projects.store.get(p.projectId);
        const text = subtitleText(project, p.format);
        if (p.path) {
          const output = await this.projects.outputPath(p.path, [`.${p.format}`]);
          await fs.writeFile(output, text, { flag: "wx", mode: 0o600 });
          return { path: output, text };
        }
        return { text };
      }
      case "ai.transcribe":
        return this.transcribe(p);
      case "ai.cleanSilence":
        return this.cleanSilence(p);
      default:
        throw new AppError("UNKNOWN_METHOD", method);
    }
  }

  private async transcribe(p: CommandParams) {
    const project = await this.projects.source(p.projectId);
    if (!project.source?.microphone && !project.source?.systemAudio)
      throw new AppError("NO_AUDIO", "This recording has no audio track to transcribe.");
    if (this.jobs.active(p.projectId).some((job) => job.kind === "transcribe"))
      throw new AppError("PROJECT_BUSY", "This project is already being transcribed.");
    const settings = this.settings();
    const model = p.model ?? settings.transcriptionModel;
    const language = p.language ?? settings.language;
    return this.jobs.start("transcribe", project.id, async (signal, progress, jobId) => {
      const jobDir = path.join(this.projects.store.dir(project.id), "cache", jobId);
      await fs.mkdir(jobDir, { recursive: true, mode: 0o700 });
      const audioPath = path.join(jobDir, "audio.wav");
      try {
        progress(0.02, "Preparing audio");
        await this.native("audio.prepare", {
          projectDir: this.projects.store.dir(project.id),
          source: project.source,
          path: audioPath,
        });
        signal.throwIfAborted();
        const transcript = await this.localAI.transcribe(
          model,
          audioPath,
          path.join(jobDir, "transcript"),
          language,
          signal,
          progress,
        );
        signal.throwIfAborted();
        const result = await this.projects.store.mutate(project.id, project.revision, (current) => {
          current.transcript = transcript
            .map((segment) => ({
              ...segment,
              endMs: Math.min(segment.endMs, current.source!.durationMs),
            }))
            .filter((segment) => segment.endMs > segment.startMs);
          current.edits.captions.enabled = true;
        });
        return this.preview.refresh(result);
      } finally {
        await fs.rm(audioPath, { force: true });
      }
    });
  }

  private async cleanSilence(p: CommandParams) {
    const project = await this.projects.source(p.projectId);
    if (!project.source?.microphone)
      throw new AppError("NO_MICROPHONE", "Silence cleanup requires a separate microphone track.");
    if (p.expectedRevision !== undefined) checkRevision(project.revision, p.expectedRevision);
    return this.jobs.start("silence", project.id, async (signal, progress) => {
      progress(0.1, "Measuring microphone and system audio");
      const result = await this.analyzeSilence(
        project,
        p.thresholdDb,
        p.minSilenceMs,
        p.paddingMs,
        p.preserveSystemAudio,
      );
      signal.throwIfAborted();
      if (p.apply && result.operations.length)
        return this.editing.apply({
          projectId: project.id,
          expectedRevision: project.revision,
          operations: result.operations,
        });
      return result;
    });
  }
}
