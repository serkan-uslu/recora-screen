import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
export { openUrl } from "@tauri-apps/plugin-opener";
export const desktop = isTauri();
export async function pickPath(
  kind: "project" | "image" | "video" | "audio" | "gif" | "export" | "srt" | "vtt",
  name = "Untitled",
): Promise<string | null> {
  if (!desktop)
    return window.prompt(
      kind === "project"
        ? "Absolute path to a project folder"
        : kind === "image"
          ? "Absolute path to a PNG or JPEG image"
          : kind === "video"
            ? "Absolute path to an MP4, MOV or M4V video"
            : kind === "audio"
              ? "Absolute path to an audio file"
              : `Absolute output path for ${name}.${kind === "export" ? "mp4" : kind}`,
    );
  if (kind === "project")
    return await open({
      directory: true,
      multiple: false,
      title: "Open a Recora Screen project",
    });
  if (kind === "audio")
    return await open({
      multiple: false,
      title: "Add audio",
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "aiff", "caf"] }],
    });
  if (kind === "video")
    return await open({
      multiple: false,
      title: "Insert a video",
      filters: [{ name: "Videos", extensions: ["mp4", "mov", "m4v"] }],
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
