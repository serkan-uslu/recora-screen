import type { RefObject } from "react";
import { X } from "lucide-react";
import type { EditOperation, Project } from "@/shared/types";
import { IconButton } from "@/src/components/atoms/IconButton";
import { Field } from "@/src/components/molecules/Field";
import type { TimelineInterval } from "@/src/features/editor/hooks/useTimelineGeometry";

const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8];

export function ClipContextMenu({
  menuRef,
  position,
  project,
  intervals,
  clip,
  timeMs,
  disabled,
  close,
  apply,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  position: { x: number; y: number };
  project: Project;
  intervals: TimelineInterval[];
  clip: TimelineInterval;
  timeMs: number;
  disabled: boolean;
  close: () => void;
  apply: (operations: EditOperation[]) => void;
}) {
  const action = (operations: EditOperation[]) => {
    close();
    apply(operations);
  };
  const canMerge = (index: number) => {
    const before = intervals[index];
    const after = intervals[index + 1];
    return Boolean(
      before &&
      after &&
      Math.abs(before.endMs - after.startMs) < 0.01 &&
      (before.speed ?? 1) === (after.speed ?? 1),
    );
  };
  return (
    <div
      ref={menuRef}
      className="clip-context-menu"
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-label={`Clip ${clip.index + 1} actions`}
    >
      <div className="clip-context-header">
        <strong>Clip {clip.index + 1}</strong>
        <IconButton label="Close clip actions" onClick={close}>
          <X size={12} />
        </IconButton>
      </div>
      <div className="clip-context-actions">
        <Field label="Playback speed">
          <select
            value={clip.speed ?? 1}
            disabled={disabled}
            onChange={(event) =>
              action([
                {
                  type: "speed",
                  startMs: clip.outputStart,
                  endMs: clip.outputEnd,
                  speed: Number(event.target.value),
                },
              ])
            }
          >
            {speeds.map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </Field>
        <button
          disabled={disabled || timeMs <= clip.outputStart || timeMs >= clip.outputEnd}
          onClick={() => action([{ type: "split", atMs: timeMs }])}
        >
          Split here
        </button>
        <button
          disabled={disabled || intervals.length < 2}
          onClick={() =>
            action([{ type: "cut", startMs: clip.outputStart, endMs: clip.outputEnd }])
          }
        >
          Delete clip
        </button>
        <button
          disabled={disabled || !canMerge(clip.index - 1)}
          onClick={() => action([{ type: "clip.merge", index: clip.index - 1 }])}
        >
          Merge with previous
        </button>
        <button
          disabled={disabled || !canMerge(clip.index)}
          onClick={() => action([{ type: "clip.merge", index: clip.index }])}
        >
          Merge with next
        </button>
      </div>
      <form
        key={`${project.revision}-${clip.index}`}
        className="clip-trim-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          action([
            {
              type: "clip.trim",
              index: clip.index,
              sourceStartMs: Number(data.get("sourceStart")) * 1000,
              sourceEndMs: Number(data.get("sourceEnd")) * 1000,
            },
          ]);
        }}
      >
        <Field label="Source in (s)">
          <input
            aria-label="Clip source start in seconds"
            name="sourceStart"
            type="number"
            step={0.001}
            min={(intervals[clip.index - 1]?.endMs ?? 0) / 1000}
            max={(clip.endMs - 1) / 1000}
            defaultValue={clip.startMs / 1000}
          />
        </Field>
        <Field label="Source out (s)">
          <input
            aria-label="Clip source end in seconds"
            name="sourceEnd"
            type="number"
            step={0.001}
            min={(clip.startMs + 1) / 1000}
            max={(intervals[clip.index + 1]?.startMs ?? project.source!.durationMs) / 1000}
            defaultValue={clip.endMs / 1000}
          />
        </Field>
        <button className="button secondary" disabled={disabled}>
          Apply trim
        </button>
      </form>
    </div>
  );
}
