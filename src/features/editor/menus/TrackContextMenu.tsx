import type { RefObject } from "react";
import { Camera, Eye, EyeOff, Layers, ZoomIn } from "lucide-react";
import { defaultAutoZoom, type EditOperation, type Project, type Range } from "@/shared/types";
import { seconds } from "@/src/lib/format";
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
  onSelectZoom,
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
  onSelectZoom: (id: string) => void;
  onSelectOverlay: (id: string) => void;
}) {
  const selected = selection.endMs > selection.startMs;
  const action = (run: () => void) => {
    close();
    run();
  };
  return (
    <div
      ref={menuRef}
      className="timeline-row-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      aria-label={`${menu.kind} track actions`}
    >
      <strong>{menu.kind[0]!.toUpperCase() + menu.kind.slice(1)} track</strong>
      {selected && (
        <small>
          {seconds(selection.startMs)}–{seconds(selection.endMs)}s selected
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
            disabled={disabled || !selected}
            onClick={() => action(() => apply([{ type: "cut", ...selection }]))}
          >
            Cut selection
          </button>
          <button
            disabled={disabled || !selected}
            onClick={() => action(() => apply([{ type: "trim", ...selection }]))}
          >
            Keep selection
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
            {project.edits.camera.visible ? "Hide camera" : "Show camera"}
          </button>
          <button
            disabled={disabled || !project.source?.camera || !selected}
            onClick={() =>
              action(() => apply([{ type: "camera.hide", ...selection, hidden: true }]))
            }
          >
            Hide in selection
          </button>
          <button
            disabled={disabled || !project.source?.camera || !selected}
            onClick={() =>
              action(() => apply([{ type: "camera.hide", ...selection, hidden: false }]))
            }
          >
            Show in selection
          </button>
          <button
            disabled={disabled || !project.source?.camera || !selected}
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
              {project.edits.audio.microphoneVolume ? "Mute microphone" : "Unmute microphone"}
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
              {project.edits.audio.systemVolume ? "Mute system audio" : "Unmute system audio"}
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
            <button onClick={() => action(() => onSelectZoom(menu.zoomId!))}>
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
            disabled={disabled || !selected}
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
