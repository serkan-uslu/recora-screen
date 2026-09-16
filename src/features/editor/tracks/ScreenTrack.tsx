import type { MouseEvent, PointerEvent } from "react";
import { Plus } from "lucide-react";
import type { EditOperation, Range } from "@/shared/types";
import { seconds } from "@/src/lib/format";
import { TimelineClip } from "@/src/features/editor/clips/TimelineClip";
import type {
  TimelineGap,
  TimelineInterval,
} from "@/src/features/editor/hooks/useTimelineGeometry";
import type { TimelineDrag, TimelinePointerEvents } from "@/src/features/editor/timelineTypes";

export function ScreenTrack({
  projectId,
  intervals,
  gaps,
  draft,
  selectedClip,
  disabled,
  ratio,
  timeAt,
  onSelectClip,
  openClipMenu,
  openTrackMenu,
  startDrag,
  pointerEvents,
  apply,
  hasSource,
}: {
  projectId: string;
  intervals: TimelineInterval[];
  gaps: TimelineGap[];
  draft: TimelineDrag | null;
  selectedClip: number;
  disabled: boolean;
  ratio: (value: number) => string;
  timeAt: (clientX: number) => number;
  onSelectClip: (index: number) => void;
  openClipMenu: (index: number, clientX?: number, clientY?: number) => void;
  openTrackMenu: (event: MouseEvent<HTMLElement>, kind: "screen") => void;
  startDrag: (
    event: PointerEvent<HTMLElement>,
    kind: "clip",
    id: string,
    index: number,
    edge: TimelineDrag["edge"],
    range: Range,
  ) => void;
  pointerEvents: TimelinePointerEvents;
  apply: (operations: EditOperation[]) => Promise<void>;
  hasSource: boolean;
}) {
  return (
    <div
      className="track screen-track"
      onContextMenu={(event) => {
        event.preventDefault();
        const at = timeAt(event.clientX);
        const clip = intervals.find(
          (interval) => at >= interval.outputStart && at <= interval.outputEnd,
        );
        if (clip) {
          openClipMenu(clip.index, event.clientX, event.clientY);
        } else openTrackMenu(event, "screen");
      }}
    >
      {intervals.map((interval) => {
        const current =
          draft?.kind === "clip" && draft.index === interval.index ? draft.next : interval;
        return (
          <TimelineClip
            projectId={projectId}
            key={`${interval.startMs}-${interval.endMs}-${interval.index}`}
            interval={interval}
            current={current}
            selected={selectedClip === interval.index}
            disabled={disabled}
            ratio={ratio}
            select={() => onSelectClip(interval.index)}
            openMenu={(event) =>
              openClipMenu(
                interval.index,
                event?.clientX ?? window.innerWidth - 612,
                event?.clientY ?? window.innerHeight - 250,
              )
            }
            startDrag={(event, edge, range) =>
              startDrag(event, "clip", "", interval.index, edge, range)
            }
            pointerEvents={pointerEvents}
          />
        );
      })}
      {gaps.map((gap, index) => (
        <button
          key={`gap-${index}`}
          className="source-gap"
          style={{ left: ratio(gap.outputMs) }}
          disabled={disabled}
          aria-label={`Restore cut from source ${seconds(gap.startMs)} to ${seconds(gap.endMs)} seconds`}
          title={`Restore ${seconds(gap.endMs - gap.startMs)}s of deleted footage`}
          onClick={() =>
            void apply([
              {
                type: "source.restore",
                startMs: gap.startMs,
                endMs: gap.endMs,
                atMs: gap.outputMs,
              },
            ])
          }
        >
          <Plus size={11} />
        </button>
      ))}
      {!hasSource && <span className="empty-track-label">Your recording will appear here</span>}
    </div>
  );
}
