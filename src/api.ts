import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { RpcResponse } from "../shared/types";

export const desktop = isTauri();
const retriable = new Set([
  "project.create",
  "project.rename",
  "project.delete",
  "project.import",
  "recording.start",
  "recording.pause",
  "recording.resume",
  "recording.stop",
  "recording.camera",
  "timeline.apply",
  "history.undo",
  "history.redo",
  "asset.import",
  "ai.transcribe",
  "ai.cleanSilence",
  "ai.assistant",
  "ai.models/download",
  "export.start",
  "jobs.cancel",
  "settings.update",
  "keychain.set",
  "keychain.delete",
]);

export async function command<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const requestId = crypto.randomUUID();
  const request = {
    id: requestId,
    method,
    params: { ...params, ...(retriable.has(method) ? { requestId } : {}) },
  };
  let data: unknown;
  if (desktop) data = await invoke("command", { request });
  else {
    const response = await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Service returned ${response.status}`);
    }
    data = await response.json();
  }
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    (data as RpcResponse).error
  ) {
    throw new Error((data as RpcResponse).error!.message);
  }
  if (
    data &&
    typeof data === "object" &&
    "result" in data &&
    ("id" in data || Object.keys(data).length === 1)
  ) {
    return (data as RpcResponse).result as T;
  }
  return data as T;
}

export async function pickPath(
  kind: "project" | "image" | "export" | "srt" | "vtt",
  name = "Untitled",
): Promise<string | null> {
  if (!desktop)
    return window.prompt(
      kind === "project"
        ? "Absolute path to a project folder"
        : kind === "image"
          ? "Absolute path to a PNG or JPEG image"
          : `Absolute output path for ${name}.${kind === "export" ? "mp4" : kind}`,
    );
  if (kind === "project")
    return await open({
      directory: true,
      multiple: false,
      title: "Open a Screen Recorder project",
    });
  if (kind === "image")
    return await open({
      multiple: false,
      title: "Add an image",
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
    });
  const extension = kind === "export" ? "mp4" : kind;
  return await save({
    title: "Export",
    defaultPath: `${name}.${extension}`,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
}

export const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
