import type { MouseEvent, PointerEvent } from "react";
import { Layers, ZoomIn } from "lucide-react";
import type { Project, Range } from "@/shared/types";
import { outputRanges } from "@/shared/timeline";
import { TrimHandle } from "@/src/features/editor/clips/TrimHandle";
import type { TimelineDrag, TimelinePointerEvents } from "@/src/features/editor/timelineTypes";

export function EffectsTrack({
  project,
  draft,
  selectedZoom,
  selectedOverlay,
  disabled,
  ratio,
  setSelection,
  onSelectZoom,
  onEditZoom,
  onSelectOverlay,
  seek,
  openTrackMenu,
  startDrag,
  pointerEvents,
}: {
  project: Project;
  draft: TimelineDrag | null;
  selectedZoom: string | null;
  selectedOverlay: string | null;
  disabled: boolean;
  ratio: (value: number) => string;
  setSelection: (range: Range) => void;
  onSelectZoom: (id: string) => void;
  onEditZoom: (id: string) => void;
  onSelectOverlay: (id: string) => void;
  seek: (time: number) => Promise<void>;
  openTrackMenu: (
    event: MouseEvent<HTMLElement>,
    kind: "effects",
    target?: { zoomId?: string; overlayId?: string },
  ) => void;
  startDrag: (
    event: PointerEvent<HTMLElement>,
    kind: "zoom" | "overlay",
    id: string,
    index: number,
    edge: TimelineDrag["edge"],
    range: Range,
  ) => void;
  pointerEvents: TimelinePointerEvents;
}) {
  return (
    <>
      <div
        className="track effect-track zoom-track"
        aria-label="Zoom track"
        onContextMenu={(event) => openTrackMenu(event, "effects")}
      >
        {project.edits.zooms.map((zoom) => {
          const ranges = outputRanges(project.edits.segments, zoom);
          if (!ranges.length) return null;
          const actual = { startMs: ranges[0]!.startMs, endMs: ranges.at(-1)!.endMs };
          const current = draft?.kind === "zoom" && draft.id === zoom.id ? draft.next : actual;
          const select = () => {
            if (disabled) return;
            setSelection(current);
            onSelectZoom(zoom.id);
          };
          return (
            <div
              key={zoom.id}
              className={`clip zoom-clip ${selectedZoom === zoom.id ? "selected" : ""}`}
              style={{
                left: ratio(current.startMs),
                width: ratio(current.endMs - current.startMs),
              }}
              onContextMenu={(event) => {
                select();
                openTrackMenu(event, "effects", { zoomId: zoom.id });
              }}
              {...pointerEvents}
            >
              <TrimHandle
                edge="start"
                label="Resize zoom start"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onEditZoom(zoom.id);
                }}
                onPointerDown={(event) => startDrag(event, "zoom", zoom.id, -1, "start", actual)}
                pointerEvents={pointerEvents}
              />
              <button
                className="clip-select"
                disabled={disabled}
                aria-label={`Edit ${zoom.scale} times zoom`}
                aria-pressed={selectedZoom === zoom.id}
                onClick={select}
                onPointerDown={(event) => startDrag(event, "zoom", zoom.id, -1, "move", actual)}
                onDoubleClick={() => onEditZoom(zoom.id)}
                title="Click to select; double-click for zoom settings"
              >
                <ZoomIn size={11} />
                <span>{zoom.scale}×</span>
              </button>
              <TrimHandle
                edge="end"
                label="Resize zoom end"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onEditZoom(zoom.id);
                }}
                onPointerDown={(event) => startDrag(event, "zoom", zoom.id, -1, "end", actual)}
                pointerEvents={pointerEvents}
              />
            </div>
          );
        })}
      </div>
      <div
        className="track effect-track layer-track"
        aria-label="Layers track"
        onContextMenu={(event) => openTrackMenu(event, "effects")}
      >
        {project.edits.overlays.flatMap((overlay) =>
          outputRanges(project.edits.segments, overlay).map((range, index) => {
            const current =
              draft?.kind === "overlay" && draft.id === overlay.id && draft.index === index
                ? draft.next
                : range;
            const select = () => {
              if (disabled) return;
              setSelection(current);
              onSelectOverlay(overlay.id);
              void seek((current.startMs + current.endMs) / 2);
            };
            return (
              <div
                key={`${overlay.id}-${index}`}
                className={`clip overlay-clip ${selectedOverlay === overlay.id ? "selected" : ""}`}
                style={{
                  left: ratio(current.startMs),
                  width: ratio(current.endMs - current.startMs),
                  top: 5,
                }}
                onContextMenu={(event) => {
                  setSelection(current);
                  onSelectOverlay(overlay.id);
                  openTrackMenu(event, "effects", { overlayId: overlay.id });
                }}
                {...pointerEvents}
              >
                <TrimHandle
                  edge="start"
                  label={`Resize ${overlay.text || overlay.kind} layer start`}
                  disabled={disabled}
                  onPointerDown={(event) =>
                    startDrag(event, "overlay", overlay.id, index, "start", range)
                  }
                  pointerEvents={pointerEvents}
                />
                <button
                  className="clip-select"
                  aria-label={`Move ${overlay.text || overlay.kind} layer`}
                  aria-pressed={selectedOverlay === overlay.id}
                  disabled={disabled}
                  onClick={select}
                  onPointerDown={(event) =>
                    startDrag(event, "overlay", overlay.id, index, "move", range)
                  }
                  title="Drag to move this layer; use the edges to change its duration"
                >
                  <Layers size={10} />
                  <span>{overlay.text || overlay.kind}</span>
                </button>
                <TrimHandle
                  edge="end"
                  label={`Resize ${overlay.text || overlay.kind} layer end`}
                  disabled={disabled}
                  onPointerDown={(event) =>
                    startDrag(event, "overlay", overlay.id, index, "end", range)
                  }
                  pointerEvents={pointerEvents}
                />
              </div>
            );
          }),
        )}
      </div>
    </>
  );
}
