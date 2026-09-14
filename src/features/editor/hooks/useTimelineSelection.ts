import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { Project, Range } from "@/shared/types";
import { useStableCallback } from "@/src/controllers/useStableCallback";

type RangeDrag = {
  kind: "range" | "scrub";
  id: number;
  target: HTMLElement;
  origin: number;
  previousTime: number;
  previous: Range;
  revision: number;
  projectId: string;
};

export function useTimelineSelection({
  project,
  total,
  timeMs,
  selection,
  setSelection,
  seek,
  disabled,
  beginScrub,
  endScrub,
  tracks,
  suppressClick,
  closeMenu,
}: {
  project: Project;
  total: number;
  timeMs: number;
  selection: Range;
  setSelection: (range: Range) => void;
  seek: (time: number) => Promise<void>;
  disabled: boolean;
  beginScrub: () => void;
  endScrub: (time: number, cancelled?: boolean) => Promise<void>;
  tracks: RefObject<HTMLDivElement | null>;
  suppressClick: RefObject<boolean>;
  closeMenu: () => void;
}) {
  const active = useRef<RangeDrag | null>(null);
  const timeAt = useStableCallback((clientX: number) => {
    const bounds = tracks.current!.getBoundingClientRect();
    return Math.max(0, Math.min(total, ((clientX - bounds.left) / bounds.width) * total));
  });
  const finishRange = useStableCallback(
    (event?: ReactPointerEvent<HTMLElement>, cancelled = false) => {
      const drag = active.current;
      if (!drag || (event && event.pointerId !== drag.id)) return;
      event?.stopPropagation();
      active.current = null;
      if (drag.target.hasPointerCapture(drag.id)) drag.target.releasePointerCapture(drag.id);
      if (cancelled) setSelection(drag.previous);
      void endScrub(
        cancelled ? drag.previousTime : event ? timeAt(event.clientX) : timeMs,
        cancelled,
      );
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    },
  );
  const startRange = (event: ReactPointerEvent<HTMLElement>, kind: "range" | "scrub") => {
    if (disabled || !total || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    const origin = timeAt(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = {
      kind,
      id: event.pointerId,
      target: event.currentTarget,
      origin,
      previousTime: timeMs,
      previous: selection,
      revision: project.revision,
      projectId: project.id,
    };
    suppressClick.current = true;
    beginScrub();
    if (kind === "range") setSelection({ startMs: origin, endMs: origin });
    void seek(origin);
  };
  const moveRange = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = active.current;
    if (!drag || drag.id !== event.pointerId) return;
    event.stopPropagation();
    const time = timeAt(event.clientX);
    if (drag.kind === "range")
      setSelection({ startMs: Math.min(drag.origin, time), endMs: Math.max(drag.origin, time) });
    void seek(time);
  };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !active.current) return;
      event.preventDefault();
      event.stopPropagation();
      finishRange(undefined, true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [finishRange]);
  useEffect(() => {
    if (
      active.current &&
      (disabled ||
        active.current.revision !== project.revision ||
        active.current.projectId !== project.id)
    )
      finishRange(undefined, true);
  }, [disabled, project.id, project.revision, finishRange]);

  return { timeAt, startRange, moveRange, finishRange };
}
