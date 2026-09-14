import { promises as fs } from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { CommandController } from "@/server/controllers/CommandController.js";
import { commandRegistry, settingsSchema } from "@/server/contracts/commands.js";
import { AppError, errorOf } from "@/server/contracts/validation.js";
import { ProjectStore, appDataDir, atomicJSON } from "@/server/infrastructure/ProjectStore.js";
import { AssistantService } from "@/server/services/AssistantService.js";
import { EditingService } from "@/server/services/EditingService.js";
import { ExportService } from "@/server/services/ExportService.js";
import { Jobs } from "@/server/services/Jobs.js";
import { PreviewService } from "@/server/services/PreviewService.js";
import { ProjectService } from "@/server/services/ProjectService.js";
import { RecordingService } from "@/server/services/RecordingService.js";
import { TranscriptionService } from "@/server/services/TranscriptionService.js";
import { LocalAI, defaultSettings, type AISettings } from "@/server/services/ai.js";
import type { CommandParams, NativeCall } from "@/server/services/types.js";
import type { RecordingStatus } from "@/shared/types.js";

export type { NativeCall } from "@/server/services/types.js";

const emptyRecording: RecordingStatus = {
  active: false,
  paused: false,
  durationMs: 0,
  microphoneLevel: 0,
  systemLevel: 0,
  cameraVisible: false,
  cameraEnabled: false,
};

export class ApplicationService extends EventEmitter {
  readonly store: ProjectStore;
  readonly jobs: Jobs;
  readonly localAI: LocalAI;
  readonly dataDir: string;

  private settings: AISettings = { ...defaultSettings };
  private readonly native: NativeCall;
  private readonly projects: ProjectService;
  private readonly recording: RecordingService;
  private readonly editing: EditingService;
  private readonly preview: PreviewService;
  private readonly exporting: ExportService;
  private readonly transcription: TranscriptionService;
  private readonly assistant: AssistantService;
  private readonly commands = new CommandController((method, params) =>
    this.dispatch(method, params),
  );

  constructor(
    options: {
      projectsDir?: string;
      dataDir?: string;
      native?: NativeCall;
      whisper?: string;
    } = {},
  ) {
    super();
    this.dataDir = options.dataDir ?? appDataDir;
    this.store = new ProjectStore(options.projectsDir);
    this.store.on("changed", (data) => this.emit("project-changed", data));
    this.jobs = new Jobs(this.dataDir);
    this.localAI = new LocalAI(path.join(this.dataDir, "models"), options.whisper);
    this.native =
      options.native ??
      (async () => {
        throw new AppError(
          "NATIVE_UNAVAILABLE",
          "Open the macOS desktop app to use recording, playback, audio analysis, export and Keychain.",
        );
      });
    this.preview = new PreviewService(this.store, this.native, (projectId) =>
      this.projects.source(projectId),
    );
    this.projects = new ProjectService(this.store, this.jobs, this.native, this.preview, (data) =>
      this.emit("project-changed", data),
    );
    this.editing = new EditingService(this.store, this.preview);
    this.recording = new RecordingService(this.store, this.jobs, this.native, this.preview);
    this.exporting = new ExportService(this.projects, this.jobs, this.native);
    this.transcription = new TranscriptionService(
      this.projects,
      this.editing,
      this.preview,
      this.jobs,
      this.localAI,
      this.native,
      () => this.settings,
    );
    this.assistant = new AssistantService(
      this.projects,
      this.transcription,
      this.preview,
      this.jobs,
      this.localAI,
      this.native,
      () => this.settings,
    );
  }

  async initialize() {
    await this.store.initialize();
    await fs.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    try {
      this.settings = settingsSchema.parse(
        JSON.parse(await fs.readFile(path.join(this.dataDir, "settings.json"), "utf8")),
      );
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
        console.error("Using default settings:", errorOf(error).message);
    }
    await this.jobs.initialize();
  }

  async flush() {
    await this.store.flush();
    await this.jobs.flush();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CommandController validates each method before dispatch.
  command(method: string, input: unknown = {}): Promise<any> {
    return this.commands.command(method, input);
  }

  private async settingsResult() {
    return {
      ...this.settings,
      hasOpenaiKey: Boolean(await this.assistant.key("openai").catch(() => "")),
      hasAnthropicKey: Boolean(await this.assistant.key("anthropic").catch(() => "")),
    };
  }

  private async dispatch(method: string, p: CommandParams): Promise<unknown> {
    if (method.startsWith("project.")) return this.projects.command(method, p);
    if (method.startsWith("recording.")) return this.recording.command(method, p);
    if (
      method.startsWith("timeline.") ||
      method.startsWith("history.") ||
      method.startsWith("camera.layout.") ||
      method === "asset.import"
    )
      return this.editing.command(method, p);
    if (method.startsWith("preview.")) return this.preview.command(method, p);
    if (method === "export.start") return this.exporting.command(method, p);
    if (["ai.transcribe", "ai.cleanSilence", "transcript.export"].includes(method))
      return this.transcription.command(method, p);
    if (method.startsWith("ai.")) return this.assistant.command(method, p);

    switch (method) {
      case "app.capabilities":
        return this.capabilities();
      case "app.canQuit": {
        const active = this.jobs.active();
        return {
          canQuit: !this.recording.activeProjectId && !active.length && !this.store.saveFailure,
          reason:
            this.store.saveFailure ??
            (this.recording.activeProjectId
              ? "Stop the recording before closing."
              : active.length
                ? "Wait for running jobs or cancel them before closing."
                : undefined),
        };
      }
      case "app.shutdown":
        if (this.recording.activeProjectId || this.jobs.active().length)
          throw new AppError(
            "APP_BUSY",
            "Stop the recording and finish or cancel running jobs before closing.",
          );
        await this.flush();
        return { ready: true };
      case "permissions.request":
        return this.native(method, p);
      case "settings.get":
        return this.settingsResult();
      case "settings.update":
        this.settings = settingsSchema.parse({ ...this.settings, ...p });
        await atomicJSON(path.join(this.dataDir, "settings.json"), this.settings);
        return this.settingsResult();
      case "keychain.set":
      case "keychain.delete":
        await this.native(method, p);
        return { ok: true };
      case "jobs.list":
        return this.jobs.list(p.projectId);
      case "jobs.get":
        return this.jobs.get(p.jobId);
      case "jobs.cancel":
        return this.jobs.cancel(p.jobId);
      default:
        throw new AppError("UNKNOWN_METHOD", method);
    }
  }

  private async capabilities() {
    const resources = process.env.SCREENREC_RESOURCES;
    const mcp = resources
      ? {
          command: path.join(resources, "bin", "node"),
          args: [path.join(resources, "mcp.mjs")],
          bundleId: "com.screenrecorder.desktop",
        }
      : null;
    const mcpCommands = Object.values(commandRegistry).map(
      ({ method, description, readOnly, destructive, permission, examples }) => ({
        method,
        description,
        readOnly,
        destructive,
        permission,
        examples,
      }),
    );
    try {
      return {
        ...(await this.native("capabilities", {})),
        nativeAvailable: true,
        mcp,
        mcpCommands,
        mcpPermissions: this.settings.mcpPermissions,
      };
    } catch (error) {
      return {
        nativeAvailable: false,
        platform: process.platform,
        permissions: {
          screen: false,
          camera: "notDetermined",
          microphone: "notDetermined",
          input: false,
        },
        sources: [],
        cameras: [],
        microphones: [],
        recording: emptyRecording,
        mcpPermissions: this.settings.mcpPermissions,
        error: errorOf(error).message,
        mcp,
        mcpCommands,
      };
    }
  }
}
