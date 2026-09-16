import type { CameraLayoutSettings, EditOperation, Project, Range } from "@/shared/types";
import { duration } from "@/shared/timeline";

export function cameraEdit(
  selection: Range,
  scope: "selection" | "entire",
  settings: Partial<CameraLayoutSettings>,
): EditOperation {
  return scope === "selection" && selection.endMs > selection.startMs
    ? { type: "camera.layout.set", ...selection, settings }
    : { type: "camera.update", settings };
}

export function cameraVisibilityEdits(
  project: Project,
  selection: Range,
  scope: "selection" | "entire",
  visible: boolean,
): EditOperation[] {
  if (scope === "entire" || selection.endMs <= selection.startMs)
    return [{ type: "camera.update", settings: { visible } }];
  const edits: EditOperation[] = [];
  // Enabling one range must not reveal the rest of a globally hidden camera track.
  if (visible && !project.edits.camera.visible)
    edits.push(
      { type: "camera.update", settings: { visible: true } },
      {
        type: "camera.hide",
        startMs: 0,
        endMs: duration(project.edits.segments),
        hidden: true,
      },
    );
  return [...edits, { type: "camera.hide", ...selection, hidden: !visible }];
}
