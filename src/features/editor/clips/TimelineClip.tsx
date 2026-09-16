import type { MouseEvent, PointerEvent } from "react";
import { Monitor } from "lucide-react";
import { formatTime } from "@/shared/timeline";
import { TimelineFilmstrip } from "@/src/features/editor/clips/TimelineFilmstrip";
import { TrimHandle } from "@/src/features/editor/clips/TrimHandle";
import type { TimelineInterval } from "@/src/features/editor/hooks/useTimelineGeometry";
import type { TimelineDrag, TimelinePointerEvents } from "@/src/features/editor/timelineTypes";

export function TimelineClip({
  projectId,
  interval,
  current,
  selected,
  disabled,
  ratio,
  select,
  openMenu,
  startDrag,
  pointerEvents,
}: {
  projectId: string;
  interval: TimelineInterval;
  current: Pick<TimelineInterval, "startMs" | "endMs">;
  selected: boolean;
  disabled: boolean;
  ratio: (value: number) => string;
  select: () => void;
  openMenu: (event?: MouseEvent<HTMLElement>) => void;
  startDrag: (
    event: PointerEvent<HTMLElement>,
    edge: TimelineDrag["edge"],
    interval: TimelineInterval,
  ) => void;
  pointerEvents: TimelinePointerEvents;
}) {
  const start = interval.outputStart + (current.startMs - interval.startMs) / (interval.speed ?? 1);
  const end = interval.outputEnd + (current.endMs - interval.endMs) / (interval.speed ?? 1);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    openMenu(event);
  };
  return (
    <div
      className={`clip screen-clip ${selected ? "selected" : ""}`}
      style={{ left: ratio(start), width: ratio(end - start) }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(event);
      }}
    >
      <TrimHandle
        edge="start"
        label={`Trim start of clip ${interval.index + 1}`}
        disabled={disabled}
        onClick={handleClick}
        onPointerDown={(event) => startDrag(event, "start", interval)}
        pointerEvents={pointerEvents}
      />
      <TimelineFilmstrip
        projectId={projectId}
        assetId={interval.assetId}
        startMs={current.startMs}
        endMs={current.endMs}
      />
      <button
        className="clip-select"
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`${interval.name} clip ${interval.index + 1}, ${interval.speed ?? 1} times speed`}
        title={`${interval.name} · Clip ${interval.index + 1} · Click for properties`}
        onClick={select}
      >
        <Monitor size={12} />
        <span>{interval.name}</span>
        <b className="clip-speed">{interval.speed ?? 1}×</b>
        <span className="clip-end">{formatTime(end - start)}</span>
      </button>
      <TrimHandle
        edge="end"
        label={`Trim end of clip ${interval.index + 1}`}
        disabled={disabled}
        onClick={handleClick}
        onPointerDown={(event) => startDrag(event, "end", interval)}
        pointerEvents={pointerEvents}
      />
    </div>
  );
}
