import { useContext } from "react";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { Plus, WandSparkles, ZoomIn } from "lucide-react";
import { type EditOperation, type Project, type Range, defaultAutoZoom } from "@/shared/types";
import { outputRanges, sourceRanges } from "@/shared/timeline";
import { Field } from "@/src/components/molecules/Field";
import { Switch } from "@/src/components/atoms/Switch";
import { Slider } from "@/src/components/molecules/Slider";
import { PanelIntro } from "@/src/components/molecules/PanelIntro";
import { RangeSummary } from "@/src/components/molecules/RangeSummary";
import { number, formatTimecode } from "@/src/lib/format";

export function ZoomPanel({
  project,
  selection,
  apply,
  selectedId,
  onSelect,
  onEdit,
}: {
  project: Project;
  selection: Range;
  apply: (ops: EditOperation[]) => Promise<void>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (id: string) => void;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const automatic = project.edits.autoZoom ?? defaultAutoZoom();
  const cursor = project.edits.cursor;
  const selected = project.edits.zooms.find((z) => z.id === selectedId);
  const changeAutomatic = (settings: Partial<typeof automatic>) =>
    void apply([{ type: "autoZoom.update", settings }]);
  return (
    <>
      <PanelIntro
        title="Zoom moments"
        text="Select a zoom to open its settings, or add one to your selected time range."
      />
      <div className="panel-divider" />
      <h3 className="panel-section">
        ZOOM MOMENTS <span>{project.edits.zooms.length}</span>
      </h3>
      <RangeSummary selection={selection} />
      <button
        className="button secondary full"
        disabled={!sourceRanges(project.edits.segments, selection.startMs, selection.endMs).length}
        onClick={() =>
          void apply([
            {
              type: "zoom.add",
              zoom: {
                ...selection,
                scale: automatic.scale,
                x: 0.5,
                y: 0.5,
                motion: automatic.motion,
                followCursor: automatic.followCursor,
              },
            },
          ])
        }
      >
        <Plus size={15} />
        Add zoom to selection
      </button>
      <p className="helper">Zooms and cursor effects apply to the original recording.</p>
      <button
        className="button secondary full"
        disabled={!selected}
        onClick={() => selected && onEdit(selected.id)}
      >
        <ZoomIn size={15} />
        Edit selected zoom
      </button>
      <div className="zoom-list">
        {project.edits.zooms.map((z, index) => {
          const ranges = outputRanges(project.edits.segments, z);
          return (
            <button
              key={z.id}
              disabled={!ranges.length}
              className={z.id === selectedId ? "selected" : ""}
              aria-pressed={z.id === selectedId}
              onClick={() => onEdit(z.id)}
            >
              <ZoomIn size={14} />
              <span>
                Zoom {index + 1}
                <small>
                  {ranges.length
                    ? `${formatTimecode(ranges[0]!.startMs)} – ${formatTimecode(ranges.at(-1)!.endMs)}`
                    : "Outside the current edit"}
                </small>
              </span>
              <b>{z.scale.toFixed(1)}×</b>
            </button>
          );
        })}
      </div>
      <details className="advanced-settings">
        <summary>Automatic zoom settings</summary>
        <Switch
          label="Auto zoom new recordings"
          checked={automatic.enabled}
          onChange={(enabled) => changeAutomatic({ enabled })}
        />
        <Slider
          label="Default zoom depth"
          min={1.1}
          max={8}
          step={0.1}
          suffix="×"
          value={automatic.scale}
          onChange={(scale) => changeAutomatic({ scale })}
        />
        <div className="two-columns">
          <Field label="Motion">
            <select
              value={automatic.motion}
              onChange={(e) => changeAutomatic({ motion: e.target.value as "gentle" | "snappy" })}
            >
              <option value="gentle">Gentle</option>
              <option value="snappy">Snappy</option>
            </select>
          </Field>
          <Field label="Hold (seconds)">
            <input
              key={`hold-${automatic.holdMs}`}
              type="number"
              min={0.2}
              max={20}
              step={0.1}
              defaultValue={automatic.holdMs / 1000}
              onBlur={(e) => {
                if (number(e.target.value) * 1000 !== automatic.holdMs)
                  changeAutomatic({ holdMs: number(e.target.value) * 1000 });
              }}
            />
          </Field>
        </div>
        <Switch
          label="Follow cursor by default"
          checked={automatic.followCursor}
          onChange={(followCursor) => changeAutomatic({ followCursor })}
        />
        <button
          className="button secondary full"
          disabled={!project.source}
          onClick={() => {
            onSelect(null);
            void apply([{ type: "zooms.auto" }]);
          }}
        >
          <WandSparkles size={15} />
          {project.edits.zooms.length ? "Redetect automatic zooms" : "Generate automatic zooms"}
        </button>
        <p className="helper">
          Uses recorded interactions. Redetect replaces the current zooms and can be undone.
        </p>
      </details>
      <div className="panel-divider" />
      <h3 className="panel-section">CURSOR</h3>
      <Switch
        label="Show cursor"
        checked={cursor.visible}
        onChange={(visible) => void apply([{ type: "cursor.update", settings: { visible } }])}
      />
      <Switch
        label="Click highlight"
        checked={cursor.highlight}
        onChange={(highlight) => void apply([{ type: "cursor.update", settings: { highlight } }])}
      />
      <Switch
        label="Smooth movement"
        checked={cursor.smooth}
        onChange={(smooth) => void apply([{ type: "cursor.update", settings: { smooth } }])}
      />
      <details className="advanced-settings">
        <summary>Cursor effects and style</summary>
        {(
          [
            ["motionBlur", "Cursor motion blur"],
            ["bounce", "Click bounce"],
            ["sway", "Cursor sway"],
            ["loop", "Loop cursor path"],
          ] as const
        ).map(([key, label]) => (
          <Switch
            key={key}
            label={label}
            checked={cursor[key] ?? false}
            onChange={(value) =>
              void apply([{ type: "cursor.update", settings: { [key]: value } }])
            }
          />
        ))}
        <label className="field">
          Cursor style
          <select
            value={cursor.style ?? "dark"}
            onChange={(e) =>
              void apply([
                {
                  type: "cursor.update",
                  settings: { style: e.target.value === "light" ? "light" : "dark" },
                },
              ])
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <Slider
          label="Cursor size"
          min={0.5}
          max={3}
          step={0.1}
          suffix="×"
          value={cursor.size}
          onPreview={(size) => draftPreview([{ type: "cursor.update", settings: { size } }])}
          onChange={(size) => void apply([{ type: "cursor.update", settings: { size } }])}
        />
      </details>
    </>
  );
}
