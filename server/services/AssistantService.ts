import { AppError, checkRevision, projectSchema } from "@/server/contracts/validation.js";
import { cursorClicks } from "@/server/domain/cursor.js";
import { applyEdits } from "@/server/domain/edits.js";
import type { Jobs } from "@/server/services/Jobs.js";
import type { PreviewService } from "@/server/services/PreviewService.js";
import type { ProjectService } from "@/server/services/ProjectService.js";
import type { TranscriptionService } from "@/server/services/TranscriptionService.js";
import { assistant, type AISettings, type LocalAI } from "@/server/services/ai.js";
import type { CommandParams, NativeCall } from "@/server/services/types.js";
import { methodSchemas } from "@/server/contracts/commands.js";
import type { EditOperation } from "@/shared/types.js";

export class AssistantService {
  constructor(
    private readonly projects: ProjectService,
    private readonly transcription: TranscriptionService,
    private readonly preview: PreviewService,
    private readonly jobs: Jobs,
    private readonly localAI: LocalAI,
    private readonly native: NativeCall,
    private readonly settings: () => AISettings,
  ) {}

  async key(provider: string): Promise<string> {
    const result = await this.native("keychain.get", { provider });
    return typeof result === "string" ? result : (result?.key ?? "");
  }

  async command(method: string, p: CommandParams): Promise<unknown> {
    switch (method) {
      case "ai.models/list":
        return this.localAI.list();
      case "ai.models/download":
        if (this.jobs.active().some((job) => job.kind === "model"))
          throw new AppError("MODEL_BUSY", "A model download is already running.");
        return this.jobs.start("model", undefined, (signal, progress) =>
          this.localAI.download(p.model, signal, progress),
        );
      case "ai.assistant":
        return this.runAssistant(p);
      default:
        throw new AppError("UNKNOWN_METHOD", method);
    }
  }

  private async runAssistant(p: CommandParams) {
    const original = await this.projects.source(p.projectId);
    const draft = structuredClone(original);
    const settings = { ...this.settings(), ...(p.provider ? { provider: p.provider } : {}) };
    const apiKey = await this.key(settings.provider);
    if (!apiKey)
      throw new AppError(
        "API_KEY_MISSING",
        `Add your ${settings.provider === "openai" ? "OpenAI" : "Anthropic"} API key in Settings first.`,
      );
    return this.jobs.start("assistant", p.projectId, async (signal, progress) => {
      const result = await assistant(
        settings,
        apiKey,
        p.prompt,
        async () => structuredClone(draft),
        async (input) => {
          const args = methodSchemas["timeline.apply"]!.parse({
            ...input,
            projectId: draft.id,
          }) as { expectedRevision: number; operations: EditOperation[] };
          checkRevision(draft.revision, args.expectedRevision);
          const next = structuredClone(draft);
          const clicks =
            args.operations.some((operation) => operation.type === "zooms.auto") &&
            next.source?.cursor
              ? await cursorClicks(
                  await this.projects.store.resolveMedia(next.id, next.source.cursor),
                )
              : [];
          applyEdits(next, args.operations, clicks);
          projectSchema.parse(next);
          next.revision++;
          Object.assign(draft, next);
          return structuredClone(draft);
        },
        signal,
        progress,
        () => this.transcription.analyzeSilence(draft),
      );
      signal.throwIfAborted();
      if (draft.revision !== original.revision)
        result.project = await this.preview.refresh(
          await this.projects.store.mutate(original.id, original.revision, (project) => {
            project.edits = draft.edits;
            project.transcript = draft.transcript;
          }),
        );
      else result.project = await this.projects.store.get(original.id);
      return result;
    });
  }
}
