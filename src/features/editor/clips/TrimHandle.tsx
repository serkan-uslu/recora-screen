import type { MouseEventHandler, PointerEventHandler } from "react";
import type { TimelinePointerEvents } from "@/src/features/editor/timelineTypes";

export function TrimHandle({
  edge,
  label,
  disabled,
  onPointerDown,
  pointerEvents,
  onClick,
  tabIndex,
}: {
  edge: "start" | "end";
  label: string;
  disabled: boolean;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  pointerEvents: TimelinePointerEvents;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  tabIndex?: number;
}) {
  return (
    <button
      className={`trim-handle ${edge}`}
      aria-label={label}
      title="Drag to trim; use clip actions for exact times"
      disabled={disabled}
      tabIndex={tabIndex}
      onClick={onClick}
      onPointerDown={onPointerDown}
      {...pointerEvents}
    />
  );
}
