import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { Monitor } from "lucide-react";
import { formatTime } from "@/shared/timeline";
import { TrimHandle } from "@/src/features/editor/clips/TrimHandle";
import type { TimelineInterval } from "@/src/features/editor/hooks/useTimelineGeometry";
import type { TimelineDrag, TimelinePointerEvents } from "@/src/features/editor/timelineTypes";

export function TimelineClip({
  interval,
  current,
  intervalCount,
  selected,
  disabled,
  ratio,
  select,
  openMenu,
  startDrag,
  pointerEvents,
}: {
  interval: TimelineInterval;
  current: Pick<TimelineInterval, "startMs" | "endMs">;
  intervalCount: number;
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
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    select();
    openMenu();
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    openMenu(event);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Screen clip ${interval.index + 1}, ${interval.speed ?? 1} times speed`}
      className={`clip screen-clip ${selected ? "selected" : ""}`}
      style={{ left: ratio(start), width: ratio(end - start) }}
      onKeyDown={keyboard}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        select();
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
      <Monitor size={12} />
      <span>Screen {intervalCount > 1 ? interval.index + 1 : ""}</span>
      <b className="clip-speed">{interval.speed ?? 1}×</b>
      <span className="clip-end">{formatTime(end - start)}</span>
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
