import path from "node:path";
import { z } from "zod";
import {
  captureSchema,
  finite,
  id,
  operationsSchema,
  cameraLayoutSettings,
  time,
} from "./validation.js";
const none = z.object({}).strict(),
  projectId = { projectId: id },
  revision = { ...projectId, expectedRevision: finite.int().min(0) };
const absolutePath = z
  .string()
  .min(1)
  .max(4000)
  .refine(
    (p) => path.isAbsolute(p) && !p.includes("\0"),
    "An absolute file path is required",
  );
const provider = z.enum(["openai", "anthropic"]);
const model = z.enum(["base", "small"]);
export const settingsSchema = z
  .object({
    provider,
    openaiModel: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/),
    anthropicModel: z.string().regex(/^[a-zA-Z0-9._:-]{1,100}$/),
    transcriptionModel: model,
    language: z.string().regex(/^(auto|[a-z]{2,3})$/),
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
  "project.create": z
    .object({ name: z.string().min(1).max(200).optional() })
    .strict(),
  "project.open": withProject,
  "project.save": withProject,
  "project.rename": z
    .object({ ...revision, name: z.string().min(1).max(200) })
    .strict(),
  "project.delete": z
    .object({ ...projectId, expectedRevision: finite.int().min(0).optional() })
    .strict(),
  "project.import": z
    .object({ path: absolutePath, name: z.string().min(1).max(200).optional() })
    .strict(),
  "recording.start": z
    .object({ ...projectId, settings: captureSchema })
    .strict(),
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
  "timeline.apply": z
    .object({ ...revision, operations: operationsSchema })
    .strict(),
  "camera.layout.set": z.object({ ...revision, startMs: time, endMs: time, settings: cameraLayoutSettings.partial() }).strict(),
  "camera.layout.remove": z.object({ ...revision, startMs: time, endMs: time }).strict(),
  "history.undo": z.object(revision).strict(),
  "history.redo": z.object(revision).strict(),
  "asset.import": z
    .object({
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
  "preview.reset": z.object({ ...revision, sequence: finite.int().min(0), inputAtMs: finite.min(0).optional() }).strict(),
  "preview.metrics": z.object({ reset: z.boolean().optional() }).strict(),
  "preview.geometry": z.object({ timeMs: time.optional() }).strict(),
  "preview.selection": z.object({ selection: z.object({ kind: z.enum(["camera", "overlay"]), id: id.optional() }).strict().nullable(), color: z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/).optional() }).strict(),
  "preview.bounds": z
    .object({
      x: finite,
      y: finite,
      width: finite.min(0).max(16384),
      height: finite.min(0).max(16384),
    })
    .strict(),
  "preview.draft": z
    .object({ ...revision, operations: operationsSchema, sequence: finite.int().min(0).optional(), inputAtMs: finite.min(0).optional() })
    .strict(),
  "preview.seek": z.object({ timeMs: time, inputAtMs: finite.min(0).optional() }).strict(),
  "preview.play": none,
  "preview.pause": none,
  "preview.status": none,
  "preview.frame": z.object({ ...projectId, timeMs: time }).strict(),
  "export.start": z
    .object({
      ...projectId,
      path: absolutePath,
      quality: z.enum(["720", "1080", "4k"]).optional(),
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
  "settings.get",
  "ai.models/list",
  "jobs.list",
  "jobs.get",
  "preview.status",
  "preview.geometry",
]);
export const isReadOnly = (method: string) => readOnly.has(method);
