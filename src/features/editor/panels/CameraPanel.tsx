import { useContext } from "react";
import { Camera, Eye, EyeOff } from "lucide-react";
import {
  type EditOperation,
  type CameraLayoutSettings,
  type Project,
  type Range,
} from "@/shared/types";
import { cameraAt } from "@/shared/camera";
import { cameraEdit } from "@/src/controllers/cameraEdit";
import { outputSize } from "@/shared/timeline";
import { Switch } from "@/src/components/atoms/Switch";
import { Slider } from "@/src/components/molecules/Slider";
import { PanelIntro } from "@/src/components/molecules/PanelIntro";
import { RangeSummary } from "@/src/components/molecules/RangeSummary";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { seconds } from "@/src/lib/format";

export function CameraPanel({
  project,
  selection,
  cameraScope,
  onScopeChange,
  apply,
}: {
  project: Project;
  selection: Range;
  cameraScope: "selection" | "entire";
  onScopeChange: (scope: "selection" | "entire") => void;
  apply: (ops: EditOperation[]) => Promise<void>;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const ranged = cameraScope === "selection" && selection.endMs > selection.startMs;
  const camera = ranged
    ? cameraAt(project, (selection.startMs + selection.endMs) / 2)
    : project.edits.camera;
  const preview = (settings: Partial<CameraLayoutSettings>) =>
    draftPreview([cameraEdit(selection, cameraScope, settings)]);
  const output = outputSize(project);
  const aspect = output.width / output.height;
  const update = (settings: Partial<CameraLayoutSettings>) =>
    void apply([cameraEdit(selection, cameraScope, settings)]);
  return (
    <>
      <PanelIntro
        title="Put a face to your story."
        text="Your camera stays on its own track, so you’re always in control."
      />
      {project.source && !project.source.camera && (
        <p className="inline-note">This recording has no camera track.</p>
      )}
      <Switch
        label="Show camera"
        checked={project.edits.camera.visible}
        onChange={(visible) => void apply([{ type: "camera.update", settings: { visible } }])}
      />
      <div className="edit-scope" role="group" aria-label="Camera layout applies to">
        <button
          aria-pressed={ranged}
          disabled={selection.endMs <= selection.startMs}
          onClick={() => onScopeChange("selection")}
        >
          Selected range
        </button>
        <button aria-pressed={!ranged} onClick={() => onScopeChange("entire")}>
          Entire video
        </button>
      </div>
      <p className="helper">
        {ranged
          ? `Layout for ${seconds(selection.startMs)}–${seconds(selection.endMs)}s. Drag or resize your camera in the preview.`
          : "Default layout for the video. Saved range layouts keep their own settings."}
      </p>
      <h3 className="panel-section">APPEARANCE</h3>
      <div className="shape-options">
        <button
          className={camera.shape === "circle" ? "selected" : ""}
          aria-pressed={camera.shape === "circle"}
          onClick={() => update({ shape: "circle" })}
        >
          <span className="shape-demo circle">
            <Camera size={18} />
          </span>
          Circle
        </button>
        <button
          className={camera.shape === "square" ? "selected" : ""}
          aria-pressed={camera.shape === "square"}
          onClick={() => update({ shape: "square" })}
        >
          <span className="shape-demo square">
            <Camera size={18} />
          </span>
          Square
        </button>
      </div>
      <Slider
        label="Size"
        min={0.08}
        max={Math.min(0.5, 1 / aspect)}
        value={camera.size}
        onPreview={(v) =>
          preview({
            size: v,
            x: Math.min(camera.x, 1 - v),
            y: Math.max(0, Math.min(camera.y, 1 - v * aspect)),
          })
        }
        onChange={(v) =>
          update({
            size: v,
            x: Math.min(camera.x, 1 - v),
            y: Math.max(0, Math.min(camera.y, 1 - v * aspect)),
          })
        }
      />
      <Slider
        label="Horizontal position"
        max={Math.max(0, 1 - camera.size)}
        value={camera.x}
        onPreview={(x) => preview({ x })}
        onChange={(v) => update({ x: v })}
      />
      <Slider
        label="Vertical position"
        max={Math.max(0, 1 - camera.size * aspect)}
        value={camera.y}
        onPreview={(y) => preview({ y })}
        onChange={(v) => update({ y: v })}
      />
      <Switch label="Soft shadow" checked={camera.shadow} onChange={(v) => update({ shadow: v })} />
      {ranged && (
        <button
          className="button subtle full"
          onClick={() => void apply([{ type: "camera.layout.remove", ...selection }])}
        >
          Reset selected layout
        </button>
      )}
      <div className="panel-divider" />
      <h3 className="panel-section">VISIBILITY</h3>
      <RangeSummary selection={selection} />
      <div className="button-row">
        <button
          className="button secondary"
          disabled={selection.endMs <= selection.startMs}
          onClick={() => void apply([{ type: "camera.hide", ...selection, hidden: true }])}
        >
          <EyeOff size={14} />
          Hide here
        </button>
        <button
          className="button secondary"
          disabled={selection.endMs <= selection.startMs}
          onClick={() => void apply([{ type: "camera.hide", ...selection, hidden: false }])}
        >
          <Eye size={14} />
          Show here
        </button>
      </div>
      <p className="helper">Select an interval in the timeline to hide or restore your camera.</p>
      {project.edits.camera.hiddenRanges.length > 0 && (
        <div className="interval-list">
          {project.edits.camera.hiddenRanges.map((r, i) => (
            <div key={i}>
              <EyeOff size={13} />
              <span>
                {seconds(r.startMs)}s – {seconds(r.endMs)}s
              </span>
              <small>source</small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
