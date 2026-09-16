import type { RefObject } from "react";
import { X } from "lucide-react";
import type { EditOperation, Project } from "@/shared/types";
import { segmentSourceDuration } from "@/shared/timeline";
import { IconButton } from "@/src/components/atoms/IconButton";
import { Field } from "@/src/components/molecules/Field";
import type { TimelineInterval } from "@/src/features/editor/hooks/useTimelineGeometry";

const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8];

export function ClipContextMenu({
  embedded = false,
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
  embedded?: boolean;
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
      before.assetId === after.assetId &&
      Math.abs(before.endMs - after.startMs) < 0.01 &&
      (before.speed ?? 1) === (after.speed ?? 1),
    );
  };
  return (
    <div
      ref={menuRef}
      className={embedded ? "clip-inspector" : "clip-context-menu"}
      style={embedded ? undefined : { left: position.x, top: position.y }}
      role={embedded ? "group" : "dialog"}
      aria-label={`Clip ${clip.index + 1} actions`}
    >
      <div className="clip-context-header">
        <strong>
          Clip {clip.index + 1} · {clip.name}
        </strong>
        {!embedded && (
          <IconButton label="Close clip actions" onClick={close}>
            <X size={12} />
          </IconButton>
        )}
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
      <div className="clip-context-actions">
        <button
          disabled={disabled || clip.index === 0}
          onClick={() =>
            action([{ type: "clip.move", index: clip.index, toIndex: clip.index - 1 }])
          }
        >
          Move earlier
        </button>
        <button
          disabled={disabled || clip.index === intervals.length - 1}
          onClick={() =>
            action([{ type: "clip.move", index: clip.index, toIndex: clip.index + 1 }])
          }
        >
          Move later
        </button>
        <Field label="Clip position">
          <select
            value={clip.index}
            disabled={disabled || intervals.length < 2}
            onChange={(event) =>
              action([
                { type: "clip.move", index: clip.index, toIndex: Number(event.target.value) },
              ])
            }
          >
            {intervals.map((interval) => (
              <option key={interval.index} value={interval.index}>
                {interval.index + 1} of {intervals.length}
              </option>
            ))}
          </select>
        </Field>
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
            min={0}
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
            max={segmentSourceDuration(project, clip) / 1000}
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
