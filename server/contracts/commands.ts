import path from "node:path";
import { z } from "zod";
import {
  captureSchema,
  finite,
  id,
  operationsSchema,
  cameraLayoutSettings,
  time,
} from "@/server/contracts/validation.js";
import { defaultMcpPermissions, type McpPermissionCategory } from "@/shared/types.js";
const none = z.object({}).strict(),
  projectId = { projectId: id },
  revision = { ...projectId, expectedRevision: finite.int().min(0) };
const absolutePath = z
  .string()
  .min(1)
  .max(4000)
  .refine((p) => path.isAbsolute(p) && !p.includes("\0"), "An absolute file path is required");
const provider = z.enum(["openai", "anthropic"]);
const model = z.enum(["base", "small"]);
export const mcpPermissionsSchema = z
  .object({
    read: z.boolean(),
    edit: z.boolean(),
    export: z.boolean(),
    recording: z.boolean(),
    sensitive: z.boolean(),
    destructive: z.boolean(),
  })
  .strict();
export const settingsSchema = z
  .object({
    provider,
    openaiModel: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/),
    anthropicModel: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/),
    transcriptionModel: model,
    language: z.string().regex(/^(auto|[a-z]{2,3})$/),
    mcpPermissions: mcpPermissionsSchema.default(defaultMcpPermissions),
  })
  .strict();
const withProject = z.object(projectId).strict();
export const methodSchemas: Record<string, z.ZodType> = {
  "app.capabilities": none,
  "app.canQuit": none,
  "app.shutdown": none,
  "permissions.request": z
    .object({ kind: z.enum(["screen", "camera", "microphone", "input"]) })
    .strict(),
  "project.list": none,
  "project.create": z.object({ name: z.string().min(1).max(200).optional() }).strict(),
  "project.open": withProject,
  "project.save": withProject,
  "project.rename": z.object({ ...revision, name: z.string().min(1).max(200) }).strict(),
  "project.delete": z
    .object({ ...projectId, expectedRevision: finite.int().min(0).optional() })
    .strict(),
  "project.import": z
    .object({ path: absolutePath, name: z.string().min(1).max(200).optional() })
    .strict(),
  "recording.start": z.object({ ...projectId, settings: captureSchema }).strict(),
  "recording.pause": z.object({ projectId: id.optional() }).strict(),
  "recording.resume": z.object({ projectId: id.optional() }).strict(),
  "recording.stop": z.object({ projectId: id.optional() }).strict(),
  "recording.status": none,
  "recording.camera": z
    .object({
      visible: z.boolean().optional(),
      enabled: z.boolean().optional(),
      shape: z.enum(["circle", "square"]).optional(),
    })
    .strict(),
  "timeline.apply": z.object({ ...revision, operations: operationsSchema }).strict(),
  "camera.layout.set": z
    .object({ ...revision, startMs: time, endMs: time, settings: cameraLayoutSettings.partial() })
    .strict(),
  "camera.layout.remove": z.object({ ...revision, startMs: time, endMs: time }).strict(),
  "history.undo": z.object(revision).strict(),
  "history.redo": z.object(revision).strict(),
  "asset.import": z
    .object({
      kind: z.enum(["image", "audio", "video"]).optional(),
      ...projectId,
      path: absolutePath,
      expectedRevision: finite.int().min(0).optional(),
    })
    .strict(),
  "transcript.export": z
    .object({
      ...projectId,
      format: z.enum(["srt", "vtt"]),
      path: absolutePath.optional(),
    })
    .strict(),
  "ai.transcribe": z
    .object({
      ...projectId,
      model: model.optional(),
      language: z
        .string()
        .regex(/^(auto|[a-z]{2,3})$/)
        .optional(),
    })
    .strict(),
  "ai.cleanSilence": z
    .object({
      ...projectId,
      thresholdDb: finite.min(-80).max(-10).optional(),
      minSilenceMs: finite.min(200).max(10000).optional(),
      paddingMs: finite.min(0).max(1000).optional(),
      preserveSystemAudio: z.boolean().optional(),
      apply: z.boolean().optional(),
      expectedRevision: finite.int().min(0).optional(),
    })
    .strict(),
  "ai.assistant": z
    .object({
      ...projectId,
      prompt: z.string().min(1).max(20000),
      provider: provider.optional(),
    })
    .strict(),
  "ai.models/list": none,
  "ai.models/download": z.object({ model }).strict(),
  "settings.get": none,
  "settings.update": settingsSchema.partial(),
  "keychain.set": z
    .object({
      provider,
      key: z
        .string()
        .min(10)
        .max(2000)
        .refine((k) => !/[\r\n]/.test(k), "API key must be one line"),
    })
    .strict(),
  "keychain.delete": z.object({ provider }).strict(),
  "jobs.list": z.object({ projectId: id.optional() }).strict(),
  "jobs.get": z.object({ jobId: id }).strict(),
  "jobs.cancel": z.object({ jobId: id }).strict(),
  "preview.load": withProject,
  "preview.reset": z
    .object({ ...revision, sequence: finite.int().min(0), inputAtMs: finite.min(0).optional() })
    .strict(),
  "preview.metrics": z.object({ reset: z.boolean().optional() }).strict(),
  "preview.geometry": z.object({ timeMs: time.optional() }).strict(),
  "preview.selection": z
    .object({
      selection: z
        .object({ kind: z.enum(["camera", "overlay"]), id: id.optional() })
        .strict()
        .nullable(),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/)
        .optional(),
    })
    .strict(),
  "preview.bounds": z
    .object({
      x: finite,
      y: finite,
      width: finite.min(0).max(16384),
      height: finite.min(0).max(16384),
    })
    .strict(),
  "preview.draft": z
    .object({
      ...revision,
      operations: operationsSchema,
      sequence: finite.int().min(0).optional(),
      inputAtMs: finite.min(0).optional(),
    })
    .strict(),
  "preview.seek": z.object({ timeMs: time, inputAtMs: finite.min(0).optional() }).strict(),
  "preview.play": none,
  "preview.pause": none,
  "preview.status": none,
  "preview.frame": z.object({ ...projectId, timeMs: time }).strict(),
  "preview.media": z
    .object({
      ...projectId,
      assetId: id.optional(),
      startMs: time,
      endMs: time,
      kind: z.enum(["filmstrip", "waveform"]),
    })
    .strict()
    .refine((p) => p.endMs > p.startMs, "Choose a non-empty source interval"),
  "export.start": z
    .object({
      ...projectId,
      path: absolutePath,
      quality: z.enum(["720", "1080", "4k"]).optional(),
      format: z.enum(["mp4", "gif"]).optional(),
      gifFps: z.union([z.literal(15), z.literal(20), z.literal(25), z.literal(30)]).optional(),
      loop: z.boolean().optional(),
      width: finite.int().min(16).max(3840).optional(),
      height: finite.int().min(16).max(3840).optional(),
    })
    .strict()
    .refine(
      (p) => (p.width === undefined) === (p.height === undefined),
      "Supply both width and height, or omit both to use the canvas aspect ratio",
    ),
};
const readOnly = new Set([
  "app.capabilities",
  "app.canQuit",
  "project.list",
  "project.open",
  "recording.status",
  "settings.get",
  "ai.models/list",
  "jobs.list",
  "jobs.get",
  "preview.metrics",
  "preview.status",
  "preview.geometry",
  "preview.frame",
  "preview.media",
]);
export const isReadOnly = (method: string) => readOnly.has(method);

const permissionOverrides: Partial<Record<string, McpPermissionCategory>> = {
  "app.shutdown": "destructive",
  "permissions.request": "sensitive",
  "project.delete": "destructive",
  "transcript.export": "export",
  "ai.assistant": "sensitive",
  "settings.update": "sensitive",
  "keychain.set": "sensitive",
  "keychain.delete": "sensitive",
  "export.start": "export",
};

export function mcpPermissionCategory(method: string): McpPermissionCategory {
  const override = permissionOverrides[method];
  if (override) return override;
  if (isReadOnly(method)) return "read";
  return method.startsWith("recording.") ? "recording" : "edit";
}

const descriptions: Partial<Record<string, string>> = {
  "preview.draft":
    "Render validated edits transiently in the active project preview. Requires expectedRevision. Does not save, add history, or affect export. Commit with timeline_apply; reload preview_load to discard.",
  "project.open":
    "Read a project, its current revision and source-time edit state. Source media remains immutable.",
  "timeline.apply":
    "Apply sequential edits atomically. Times are OUTPUT milliseconds except clip.trim/clip.insert sourceStartMs/sourceEndMs and source.restore startMs/endMs use SOURCE time. clip.move uses final zero-based toIndex; clip.insert splits the timeline at atMs. source.restore optionally inserts at output atMs without reordering existing clips. Speed is 0.25–8. Stale expectedRevision is rejected. One batch is one undo step.",
  "ai.cleanSilence":
    "Analyze source microphone RMS audio and protect audible system audio. By default returns suggested OUTPUT cut ranges and operations; apply=true commits one undoable edit. Returns a Job; poll jobs_get.",
  "ai.transcribe":
    "Run offline Whisper transcription with an already downloaded model. Source timestamps are preserved and captions become editable. Returns a Job.",
  "ai.assistant":
    "Send project metadata and transcript to the selected BYOK OpenAI or Anthropic provider and let it edit through validated project tools. Video is not uploaded. Returns a Job.",
  "ai.models/download":
    "Download one pinned SHA-256 verified multilingual Whisper model. base is 148 MB and small is 488 MB. Returns a Job.",
  "recording.camera":
    "Change the live camera bubble or hardware capture. Hardware-off gaps cannot be restored; use timeline_apply camera.hide for reversible post-recording visibility.",
  "project.delete":
    "Move an idle project to the operating-system Trash. Active recordings and jobs prevent deletion.",
  "export.start":
    "Render the current project snapshot to a new external MP4 or GIF. GIF supports 15/20/25/30 FPS and loop, up to 60 seconds and 1280 pixels per axis. Custom dimensions must be supplied together, even, and at most 3840 on either axis. Existing files and source media are never overwritten. Returns a Job.",
  "transcript.export":
    "Return SRT or VTT text aligned to the edited timeline and optionally write it to a new external file.",
};

const examples: Partial<Record<string, string[]>> = {
  "project.open": ['project_open({"projectId":"PROJECT_ID"})'],
  "timeline.apply": [
    'timeline_apply({"projectId":"PROJECT_ID","expectedRevision":3,"operations":[{"type":"cut","startMs":1000,"endMs":2000}]})',
  ],
  "history.undo": ['history_undo({"projectId":"PROJECT_ID","expectedRevision":4})'],
  "jobs.get": ['jobs_get({"jobId":"JOB_ID"})'],
  "preview.frame": ['preview_frame({"projectId":"PROJECT_ID","timeMs":1500})'],
  "export.start": [
    'export_start({"projectId":"PROJECT_ID","path":"/absolute/path/video.mp4","quality":"1080"})',
  ],
};

export type CommandMetadata = {
  method: string;
  schema: z.ZodType;
  description: string;
  readOnly: boolean;
  destructive: boolean;
  permission: McpPermissionCategory;
  examples: string[];
};

export const commandRegistry: Record<string, CommandMetadata> = Object.fromEntries(
  Object.entries(methodSchemas).map(([method, schema]) => {
    const permission = mcpPermissionCategory(method);
    return [
      method,
      {
        method,
        schema,
        description:
          descriptions[method] ??
          "Run the corresponding desktop application command and return its current state or background job.",
        readOnly: isReadOnly(method),
        destructive: permission === "destructive",
        permission,
        examples: examples[method] ?? [`${method.replace(/[./]/g, "_")}({ ... })`],
      },
    ];
  }),
);
