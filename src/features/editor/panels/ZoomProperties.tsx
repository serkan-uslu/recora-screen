import { useContext, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { type EditOperation, type Project, type Zoom } from "@/shared/types";
import { duration, outputRanges } from "@/shared/timeline";
import { Field } from "@/src/components/molecules/Field";
import { Switch } from "@/src/components/atoms/Switch";
import { Slider } from "@/src/components/molecules/Slider";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { number } from "@/src/lib/format";

export function ZoomProperties({
  zoom,
  project,
  apply,
  onRemove,
}: {
  zoom: Zoom;
  project: Project;
  apply: (ops: EditOperation[]) => Promise<void>;
  onRemove: () => void;
}) {
  const propertiesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    propertiesRef.current?.scrollIntoView({ block: "nearest" });
  }, [zoom.id]);
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const preview = (zoomPatch: Partial<Omit<Zoom, "id">>) =>
    draftPreview([{ type: "zoom.update", id: zoom.id, zoom: zoomPatch }]);
  const ranges = outputRanges(project.edits.segments, zoom);
  const range = ranges.length ? { startMs: ranges[0]!.startMs, endMs: ranges.at(-1)!.endMs } : null;
  const [start, setStart] = useState((range?.startMs ?? 0) / 1000);
  const [length, setLength] = useState(((range?.endMs ?? 0) - (range?.startMs ?? 0)) / 1000);
  const total = duration(project.edits.segments);
  const update = (patch: Partial<Omit<Zoom, "id">>) =>
    void apply([{ type: "zoom.update", id: zoom.id, zoom: patch }]);
  return (
    <div className="layer-properties" ref={propertiesRef}>
      <h3 className="panel-section">SELECTED ZOOM</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ startMs: start * 1000, endMs: (start + length) * 1000 });
        }}
      >
        <div className="two-columns">
          <Field label="Start (seconds)">
            <input
              type="number"
              min={0}
              max={total / 1000}
              step={0.01}
              value={start}
              onChange={(e) => setStart(number(e.target.value))}
            />
          </Field>
          <Field label="Duration (seconds)">
            <input
              type="number"
              min={0.01}
              max={Math.max(0.01, total / 1000 - start)}
              step={0.01}
              value={length}
              onChange={(e) => setLength(number(e.target.value))}
            />
          </Field>
        </div>
        <button
          className="button secondary full"
          disabled={length <= 0 || start < 0 || (start + length) * 1000 > total}
        >
          Update timing
        </button>
      </form>
      <Slider
        label="Zoom depth"
        min={1.1}
        max={4}
        step={0.1}
        suffix="×"
        value={zoom.scale}
        onChange={(scale) => update({ scale })}
        onPreview={(scale) => preview({ scale })}
      />
      <Switch
        label="Follow cursor"
        checked={zoom.followCursor ?? false}
        onChange={(followCursor) => update({ followCursor })}
      />
      {!zoom.followCursor && (
        <>
          <Slider
            label="Focus X"
            value={zoom.x}
            onChange={(x) => update({ x })}
            onPreview={(x) => preview({ x })}
          />
          <Slider
            label="Focus Y"
            value={zoom.y}
            onChange={(y) => update({ y })}
            onPreview={(y) => preview({ y })}
          />
        </>
      )}
      <Field label="Zoom motion">
        <select
          value={zoom.motion ?? "gentle"}
          onChange={(e) => update({ motion: e.target.value as "gentle" | "snappy" })}
        >
          <option value="gentle">Gentle</option>
          <option value="snappy">Snappy</option>
        </select>
      </Field>
      <button
        className="button subtle full"
        onClick={() => {
          void (async () => {
            await apply([{ type: "zoom.remove", id: zoom.id }]);
            onRemove();
          })();
        }}
      >
        <Trash2 size={14} />
        Remove zoom
      </button>
    </div>
  );
}
