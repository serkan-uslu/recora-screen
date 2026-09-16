import { useContext } from "react";
import { Camera, Eye, EyeOff } from "lucide-react";
import {
  type EditOperation,
  type CameraLayoutSettings,
  type Project,
  type Range,
} from "@/shared/types";
import { cameraAt } from "@/shared/camera";
import { cameraEdit, cameraVisibilityEdits } from "@/src/controllers/cameraEdit";
import { outputSize, sourceRanges } from "@/shared/timeline";
import { Switch } from "@/src/components/atoms/Switch";
import { Slider } from "@/src/components/molecules/Slider";
import { RangeSummary } from "@/src/components/molecules/RangeSummary";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { formatTimecode } from "@/src/lib/format";

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
  const selectedSources = sourceRanges(project.edits.segments, selection.startMs, selection.endMs);
  const originalSelected = selectedSources.length > 0;
  const visible =
    project.edits.camera.visible &&
    (!ranged ||
      selectedSources.every((range) =>
        project.edits.camera.hiddenRanges.every(
          (hidden) => hidden.endMs <= range.startMs || hidden.startMs >= range.endMs,
        ),
      ));
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
      {project.source && !project.source.camera && (
        <p className="inline-note">This recording has no camera track.</p>
      )}
      <div className="edit-scope" role="group" aria-label="Camera layout applies to">
        <button
          aria-pressed={ranged}
          disabled={!originalSelected}
          onClick={() => onScopeChange("selection")}
        >
          This selection
        </button>
        <button aria-pressed={!ranged} onClick={() => onScopeChange("entire")}>
          Video default
        </button>
      </div>
      <Switch
        label={ranged ? "Show camera in this selection" : "Enable camera track"}
        checked={visible}
        disabled={ranged && !originalSelected}
        onChange={(next) =>
          void apply(cameraVisibilityEdits(project, selection, cameraScope, next))
        }
      />
      <p className="helper">
        {ranged
          ? `Camera · ${formatTimecode(selection.startMs)}–${formatTimecode(selection.endMs)}. Drag or resize the camera in the preview.`
          : "Default appearance for footage without its own camera layout. Existing clip layouts and hidden ranges are preserved."}
      </p>
      {ranged && !originalSelected && (
        <p className="inline-note">Select original recording footage to change a camera range.</p>
      )}
      <fieldset className="unstyled-fieldset" disabled={ranged && !originalSelected}>
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
        <details className="advanced-settings">
          <summary>Position and appearance details</summary>
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
          <Switch
            label="Soft shadow"
            checked={camera.shadow}
            onChange={(v) => update({ shadow: v })}
          />
          <Switch
            label="Mirror camera"
            checked={camera.mirror ?? false}
            onChange={(mirror) => update({ mirror })}
          />
          <Switch
            label="Shrink camera during zoom"
            checked={camera.zoomReactive ?? false}
            onChange={(zoomReactive) => update({ zoomReactive })}
          />
          {camera.shape === "square" && (
            <Slider
              label="Camera corner radius"
              min={0}
              max={0.5}
              value={camera.radius ?? 0.09}
              onPreview={(radius) => preview({ radius })}
              onChange={(radius) => update({ radius })}
            />
          )}
          {camera.shadow && (
            <Slider
              label="Camera shadow opacity"
              value={camera.shadowOpacity ?? 0.4}
              onPreview={(shadowOpacity) => preview({ shadowOpacity })}
              onChange={(shadowOpacity) => update({ shadowOpacity })}
            />
          )}
        </details>
        {ranged && (
          <button
            className="button subtle full"
            onClick={() => void apply([{ type: "camera.layout.remove", ...selection }])}
          >
            Use video default for this selection
          </button>
        )}
      </fieldset>
      <details className="advanced-settings">
        <summary>Hidden camera intervals</summary>
        <RangeSummary selection={selection} />
        <div className="button-row">
          <button
            className="button secondary"
            disabled={!originalSelected}
            onClick={() =>
              void apply(cameraVisibilityEdits(project, selection, "selection", false))
            }
          >
            <EyeOff size={14} />
            Hide here
          </button>
          <button
            className="button secondary"
            disabled={!originalSelected}
            onClick={() => void apply(cameraVisibilityEdits(project, selection, "selection", true))}
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
                  {formatTimecode(r.startMs)}–{formatTimecode(r.endMs)}
                </span>
                <small>source</small>
              </div>
            ))}
          </div>
        )}
      </details>
    </>
  );
}
