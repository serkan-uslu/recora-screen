import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { EditOperation, Project, Range } from "@/shared/types";
import { useStableCallback } from "@/src/controllers/useStableCallback";
import type { TimelineInterval } from "@/src/features/editor/hooks/useTimelineGeometry";
import type { TimelineDrag, TimelinePointerEvents } from "@/src/features/editor/timelineTypes";

export function useTimelineDrag({
  project,
  total,
  intervals,
  disabled,
  tracks,
  suppressClick,
  draftPreview,
  apply,
  onSelectZoom,
}: {
  project: Project;
  total: number;
  intervals: TimelineInterval[];
  disabled: boolean;
  tracks: RefObject<HTMLDivElement | null>;
  suppressClick: RefObject<boolean>;
  draftPreview: (operations: EditOperation[] | null) => void;
  apply: (operations: EditOperation[], revision?: number) => Promise<void>;
  onSelectZoom: (id: string) => void;
}) {
  const [draft, setDraft] = useState<TimelineDrag | null>(null);
  const active = useRef<TimelineDrag | null>(null);
  const pointer = useRef<{ target: HTMLElement; id: number } | null>(null);
  const valid = useStableCallback(
    (value: TimelineDrag) =>
      !disabled &&
      value.projectId === project.id &&
      value.revision === project.revision &&
      (value.kind === "clip"
        ? Boolean(project.source) && Boolean(intervals[value.index])
        : project.edits.zooms.some((zoom) => zoom.id === value.id)),
  );
  const releasePointer = () => {
    const captured = pointer.current;
    pointer.current = null;
    if (captured?.target.hasPointerCapture(captured.id))
      captured.target.releasePointerCapture(captured.id);
  };
  const cancel = useStableCallback(() => {
    active.current = null;
    releasePointer();
    setDraft(null);
    draftPreview(null);
  });
  const startDrag = (
    event: ReactPointerEvent<HTMLElement>,
    kind: "zoom" | "clip",
    id: string,
    index: number,
    edge: TimelineDrag["edge"],
    range: Range,
  ) => {
    if (disabled || !total || event.button !== 0 || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    releasePointer();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { target: event.currentTarget, id: event.pointerId };
    const value: TimelineDrag = {
      projectId: project.id,
      revision: project.revision,
      kind,
      id,
      index,
      edge,
      originX: event.clientX,
      pixels: tracks.current?.getBoundingClientRect().width || 1,
      original: range,
      next: range,
    };
    active.current = value;
    setDraft(value);
    if (kind === "zoom") onSelectZoom(id);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const value = active.current;
    if (!value || pointer.current?.id !== event.pointerId) return;
    event.stopPropagation();
    if (!valid(value)) return cancel();
    suppressClick.current = true;
    const delta = ((event.clientX - value.originX) / value.pixels) * total;
    const original = value.original;
    let next: Range;
    if (value.kind === "clip") {
      const segment = intervals[value.index]!;
      const sourceDelta = delta * (segment.speed ?? 1);
      const minimum = intervals[value.index - 1]?.endMs ?? 0;
      const maximum = intervals[value.index + 1]?.startMs ?? project.source!.durationMs;
      next =
        value.edge === "start"
          ? {
              startMs: Math.max(
                minimum,
                Math.min(original.endMs - 1, original.startMs + sourceDelta),
              ),
              endMs: original.endMs,
            }
          : {
              startMs: original.startMs,
              endMs: Math.min(
                maximum,
                Math.max(original.startMs + 1, original.endMs + sourceDelta),
              ),
            };
    } else if (value.edge === "move") {
      const length = original.endMs - original.startMs;
      const startMs = Math.max(0, Math.min(total - length, original.startMs + delta));
      next = { startMs, endMs: startMs + length };
    } else
      next =
        value.edge === "start"
          ? {
              startMs: Math.max(0, Math.min(original.endMs - 1, original.startMs + delta)),
              endMs: original.endMs,
            }
          : {
              startMs: original.startMs,
              endMs: Math.min(total, Math.max(original.startMs + 1, original.endMs + delta)),
            };
    active.current = { ...value, next };
    setDraft(active.current);
    draftPreview(
      value.kind === "zoom"
        ? [{ type: "zoom.update", id: value.id, zoom: next }]
        : [
            {
              type: "clip.trim",
              index: value.index,
              sourceStartMs: next.startMs,
              sourceEndMs: next.endMs,
            },
          ],
    );
  };
  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const value = active.current;
    if (!value || pointer.current?.id !== event.pointerId) return;
    event.stopPropagation();
    if (!valid(value)) return cancel();
    releasePointer();
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    active.current = null;
    setDraft(null);
    if (
      Math.abs(value.original.startMs - value.next.startMs) +
        Math.abs(value.original.endMs - value.next.endMs) <
      0.01
    )
      return draftPreview(null);
    void apply(
      value.kind === "zoom"
        ? [{ type: "zoom.update", id: value.id, zoom: value.next }]
        : [
            {
              type: "clip.trim",
              index: value.index,
              sourceStartMs: value.next.startMs,
              sourceEndMs: value.next.endMs,
            },
          ],
      value.revision,
    );
  };
  const pointerEvents: TimelinePointerEvents = {
    onPointerMove: moveDrag,
    onPointerUp: finishDrag,
    onPointerCancel: (event) => {
      event.stopPropagation();
      cancel();
    },
  };

  useEffect(() => {
    if (active.current && !valid(active.current)) cancel();
  }, [project.id, project.revision, disabled, valid, cancel]);
  useEffect(
    () => () => {
      if (active.current) draftPreview(null);
      releasePointer();
    },
    [draftPreview],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !active.current) return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [cancel]);

  return { draft, startDrag, pointerEvents };
}
