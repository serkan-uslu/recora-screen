import type { RefObject } from "react";
import { Camera, Eye, EyeOff, Layers, ZoomIn } from "lucide-react";
import { defaultAutoZoom, type EditOperation, type Project, type Range } from "@/shared/types";
import { sourceRanges } from "@/shared/timeline";
import { cameraVisibilityEdits } from "@/src/controllers/cameraEdit";
import { formatTimecode } from "@/src/lib/format";
import type { TimelineMenu } from "@/src/features/editor/timelineTypes";

export function TrackContextMenu({
  menuRef,
  menu,
  project,
  selection,
  timeMs,
  total,
  disabled,
  close,
  apply,
  seek,
  onCameraLayout,
  onEditZoom,
  onSelectOverlay,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  menu: Exclude<TimelineMenu, { kind: "clip" }>;
  project: Project;
  selection: Range;
  timeMs: number;
  total: number;
  disabled: boolean;
  close: () => void;
  apply: (operations: EditOperation[]) => void;
  seek: (time: number) => Promise<void>;
  onCameraLayout: () => void;
  onEditZoom: (id: string) => void;
  onSelectOverlay: (id: string) => void;
}) {
  const selected = selection.endMs > selection.startMs;
  const originalSelected =
    sourceRanges(project.edits.segments, selection.startMs, selection.endMs).length > 0;
  const action = (run: () => void) => {
    close();
    run();
  };
  return (
    <div
      ref={menuRef}
      className="timeline-row-menu"
      style={{ left: menu.x, top: menu.y }}
      role="dialog"
      aria-label={`${menu.kind} track actions`}
    >
      <strong>{menu.kind[0]!.toUpperCase() + menu.kind.slice(1)} track</strong>
      {selected && (
        <small>
          {formatTimecode(selection.startMs)}–{formatTimecode(selection.endMs)} selected
        </small>
      )}
      {menu.kind === "screen" && (
        <>
          <button
            disabled={disabled || timeMs <= 0 || timeMs >= total}
            onClick={() => action(() => apply([{ type: "split", atMs: timeMs }]))}
          >
            Split at playhead
          </button>
          <button
            disabled={disabled || !selected || total - (selection.endMs - selection.startMs) < 1}
            onClick={() => action(() => apply([{ type: "cut", ...selection }]))}
          >
            Delete video time range
          </button>
          <button
            disabled={disabled || !selected}
            onClick={() => action(() => apply([{ type: "trim", ...selection }]))}
          >
            Keep only this video range
          </button>
        </>
      )}
      {menu.kind === "camera" && (
        <>
          <button
            disabled={disabled || !project.source?.camera}
            onClick={() =>
              action(() =>
                apply([
                  {
                    type: "camera.update",
                    settings: { visible: !project.edits.camera.visible },
                  },
                ]),
              )
            }
          >
            {project.edits.camera.visible ? <EyeOff size={13} /> : <Eye size={13} />}
            {project.edits.camera.visible ? "Disable camera track" : "Enable camera track"}
          </button>
          <button
            disabled={disabled || !project.source?.camera || !originalSelected}
            onClick={() =>
              action(() => apply(cameraVisibilityEdits(project, selection, "selection", false)))
            }
          >
            Hide in selection
          </button>
          <button
            disabled={disabled || !project.source?.camera || !originalSelected}
            onClick={() =>
              action(() => apply(cameraVisibilityEdits(project, selection, "selection", true)))
            }
          >
            Show in selection
          </button>
          <button
            disabled={disabled || !project.source?.camera || !originalSelected}
            onClick={() =>
              action(() => {
                onCameraLayout();
                void seek((selection.startMs + selection.endMs) / 2);
              })
            }
          >
            <Camera size={13} />
            Camera layout
          </button>
        </>
      )}
      {menu.kind === "audio" && (
        <>
          {project.source?.microphone && (
            <button
              disabled={disabled}
              onClick={() =>
                action(() =>
                  apply([
                    {
                      type: "audio.update",
                      settings: {
                        microphoneVolume: project.edits.audio.microphoneVolume ? 0 : 1,
                      },
                    },
                  ]),
                )
              }
            >
              {project.edits.audio.microphoneVolume ? "Mute" : "Unmute"}{" "}
              {project.source.microphone === project.source.screen ? "video audio" : "microphone"}{" "}
              (whole video)
            </button>
          )}
          {project.source?.systemAudio && (
            <button
              disabled={disabled}
              onClick={() =>
                action(() =>
                  apply([
                    {
                      type: "audio.update",
                      settings: { systemVolume: project.edits.audio.systemVolume ? 0 : 1 },
                    },
                  ]),
                )
              }
            >
              {project.edits.audio.systemVolume ? "Mute system audio" : "Unmute system audio"}{" "}
              (whole video)
            </button>
          )}
          <button
            disabled={disabled || (!project.source?.microphone && !project.source?.systemAudio)}
            onClick={() =>
              action(() =>
                apply([
                  {
                    type: "audio.update",
                    settings: { microphoneVolume: 1, systemVolume: 1 },
                  },
                ]),
              )
            }
          >
            Reset levels
          </button>
        </>
      )}
      {menu.kind === "effects" && (
        <>
          {menu.zoomId && (
            <button onClick={() => action(() => onEditZoom(menu.zoomId!))}>
              <ZoomIn size={13} />
              Edit zoom
            </button>
          )}
          {menu.zoomId && (
            <button
              disabled={disabled}
              className="danger"
              onClick={() => action(() => apply([{ type: "zoom.remove", id: menu.zoomId! }]))}
            >
              Remove zoom
            </button>
          )}
          {menu.overlayId && (
            <button onClick={() => action(() => onSelectOverlay(menu.overlayId!))}>
              <Layers size={13} />
              Edit layer
            </button>
          )}
          {menu.overlayId && (
            <button
              disabled={disabled}
              className="danger"
              onClick={() => action(() => apply([{ type: "overlay.remove", id: menu.overlayId! }]))}
            >
              Remove layer
            </button>
          )}
          <button
            disabled={disabled || !originalSelected}
            onClick={() =>
              action(() => {
                const settings = project.edits.autoZoom ?? defaultAutoZoom();
                apply([
                  {
                    type: "zoom.add",
                    zoom: {
                      ...selection,
                      scale: settings.scale,
                      x: 0.5,
                      y: 0.5,
                      motion: settings.motion,
                      followCursor: settings.followCursor,
                    },
                  },
                ]);
              })
            }
          >
            <ZoomIn size={13} />
            Add zoom to selection
          </button>
          <button
            disabled={disabled || !project.source}
            onClick={() => action(() => apply([{ type: "zooms.auto" }]))}
          >
            Redetect automatic zooms
          </button>
        </>
      )}
    </div>
  );
}
