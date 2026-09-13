import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
export { listen } from "@tauri-apps/api/event";
export { openPath, openUrl } from "@tauri-apps/plugin-opener";
export const desktop = isTauri();
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
