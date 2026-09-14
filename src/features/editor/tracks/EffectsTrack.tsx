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
  disabled,
  ratio,
  setSelection,
  onSelectZoom,
  onSelectOverlay,
  seek,
  openTrackMenu,
  startDrag,
  pointerEvents,
}: {
  project: Project;
  draft: TimelineDrag | null;
  selectedZoom: string | null;
  disabled: boolean;
  ratio: (value: number) => string;
  setSelection: (range: Range) => void;
  onSelectZoom: (id: string) => void;
  onSelectOverlay: (id: string) => void;
  seek: (time: number) => Promise<void>;
  openTrackMenu: (
    event: MouseEvent<HTMLElement>,
    kind: "effects",
    target?: { zoomId?: string; overlayId?: string },
  ) => void;
  startDrag: (
    event: PointerEvent<HTMLElement>,
    kind: "zoom",
    id: string,
    index: number,
    edge: TimelineDrag["edge"],
    range: Range,
  ) => void;
  pointerEvents: TimelinePointerEvents;
}) {
  return (
    <div className="track effect-track" onContextMenu={(event) => openTrackMenu(event, "effects")}>
      {project.edits.zooms.map((zoom) => {
        const ranges = outputRanges(project.edits.segments, zoom);
        if (!ranges.length) return null;
        const actual = { startMs: ranges[0]!.startMs, endMs: ranges.at(-1)!.endMs };
        const current = draft?.kind === "zoom" && draft.id === zoom.id ? draft.next : actual;
        const select = () => {
          onSelectZoom(zoom.id);
          setSelection(current);
        };
        return (
          <div
            key={zoom.id}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${zoom.scale} times zoom`}
            className={`clip zoom-clip ${selectedZoom === zoom.id ? "selected" : ""}`}
            style={{
              left: ratio(current.startMs),
              width: ratio(current.endMs - current.startMs),
            }}
            onClick={select}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                select();
              }
            }}
            onContextMenu={(event) => {
              select();
              openTrackMenu(event, "effects", { zoomId: zoom.id });
            }}
            onPointerDown={(event) => startDrag(event, "zoom", zoom.id, -1, "move", actual)}
            {...pointerEvents}
          >
            <TrimHandle
              edge="start"
              label="Resize zoom start"
              disabled={disabled}
              tabIndex={-1}
              onPointerDown={(event) => startDrag(event, "zoom", zoom.id, -1, "start", actual)}
              pointerEvents={pointerEvents}
            />
            <ZoomIn size={11} />
            <span>{zoom.scale}×</span>
            <TrimHandle
              edge="end"
              label="Resize zoom end"
              disabled={disabled}
              tabIndex={-1}
              onPointerDown={(event) => startDrag(event, "zoom", zoom.id, -1, "end", actual)}
              pointerEvents={pointerEvents}
            />
          </div>
        );
      })}
      {project.edits.overlays.flatMap((overlay) =>
        outputRanges(project.edits.segments, overlay).map((range, index) => (
          <button
            key={`${overlay.id}-${index}`}
            className="clip overlay-clip"
            style={{
              left: ratio(range.startMs),
              width: ratio(range.endMs - range.startMs),
              top: 19,
            }}
            onClick={() => {
              setSelection(range);
              onSelectOverlay(overlay.id);
              void seek((range.startMs + range.endMs) / 2);
            }}
            onContextMenu={(event) => {
              setSelection(range);
              onSelectOverlay(overlay.id);
              openTrackMenu(event, "effects", { overlayId: overlay.id });
            }}
            title={overlay.text || "Image"}
          >
            <Layers size={10} />
            <span>{overlay.text || "Image"}</span>
          </button>
        )),
      )}
    </div>
  );
}
