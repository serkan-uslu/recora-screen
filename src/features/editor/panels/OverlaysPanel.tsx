import { useContext, useState } from "react";
import { ImagePlus, Trash2, Type } from "lucide-react";
import { type EditOperation, type Overlay, type Project, type Range } from "@/shared/types";
import { sourceRanges } from "@/shared/timeline";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { messageOf } from "@/src/lib/errors";
import { IconButton } from "@/src/components/atoms/IconButton";
import { Field } from "@/src/components/molecules/Field";
import { Slider } from "@/src/components/molecules/Slider";
import { PanelIntro } from "@/src/components/molecules/PanelIntro";
import { RangeSummary } from "@/src/components/molecules/RangeSummary";
import { number, seconds } from "@/src/lib/format";

export function OverlaysPanel({
  project,
  selection,
  apply,
  importImage,
  onError,
  selected,
  onSelect,
}: {
  project: Project;
  selection: Range;
  apply: (ops: EditOperation[], revision?: number) => Promise<void>;
  importImage: () => Promise<unknown>;
  onError: (error: string) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const [text, setText] = useState("");
  const overlay = project.edits.overlays.find((o) => o.id === selected);
  const originalSelected =
    sourceRanges(project.edits.segments, selection.startMs, selection.endMs).length > 0;
  const update = (value: Partial<Overlay>) => {
    if (overlay) void apply([{ type: "overlay.update", id: overlay.id, overlay: value }]);
  };
  const preview = (value: Partial<Overlay>) => {
    if (overlay) draftPreview([{ type: "overlay.update", id: overlay.id, overlay: value }]);
  };
  const defaults = {
    ...selection,
    x: 0.1,
    y: 0.12,
    width: 0.8,
    fontSize: 48,
    color: "#ffffff",
    animation: "fade" as const,
  };
  return (
    <>
      <PanelIntro
        title="Add your finishing touches."
        text="Add titles and arrows, or cover a sensitive area for the selected interval."
      />
      <RangeSummary selection={selection} />
      <Field label="Text">
        <textarea
          placeholder="Something worth saying…"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <button
        className="button secondary full"
        disabled={!text.trim() || !originalSelected}
        onClick={() => {
          void (async () => {
            await apply([
              {
                type: "overlay.add",
                overlay: { ...defaults, kind: "text", text: text.trim() },
              },
            ]);
            setText("");
          })();
        }}
      >
        <Type size={15} />
        Add text to selection
      </button>
      <button
        className="button subtle full"
        disabled={!originalSelected}
        onClick={() => {
          void (async () => {
            try {
              const result = await importImage();
              if (!result) return;
              const asset =
                (result as { asset?: { id: string }; id?: string }).asset ||
                (result as { id: string });
              if (asset.id)
                await apply(
                  [
                    {
                      type: "overlay.add",
                      overlay: {
                        ...defaults,
                        kind: "image",
                        assetId: asset.id,
                        width: 0.35,
                      },
                    },
                  ],
                  (result as { revision: number }).revision,
                );
            } catch (e) {
              onError(messageOf(e));
            }
          })();
        }}
      >
        <ImagePlus size={15} />
        Add image
      </button>
      <div className="two-columns">
        {(["arrow", "blur", "redact"] as const).map((kind) => (
          <button
            key={kind}
            className="button secondary"
            disabled={!originalSelected}
            onClick={() =>
              void apply([
                {
                  type: "overlay.add",
                  overlay: {
                    ...defaults,
                    kind,
                    width: 0.25,
                    height: 0.15,
                    animation: "none",
                    color: kind === "redact" ? "#000000" : "#ffffff",
                  },
                },
              ])
            }
          >
            Add {kind === "redact" ? "solid cover" : kind}
          </button>
        ))}
      </div>
      <p className="helper">
        Blur softens an area; use a solid cover to hide sensitive details. Covers stay fixed on the
        canvas, so review their position through zooms. Layers apply to the original recording.
      </p>
      {project.assets.some((asset) => asset.kind === "image") && (
        <Field label="Imported images">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value)
                void apply([
                  {
                    type: "overlay.add",
                    overlay: {
                      ...defaults,
                      kind: "image",
                      assetId: e.target.value,
                      width: 0.35,
                    },
                  },
                ]);
              e.target.value = "";
            }}
            disabled={!originalSelected}
          >
            <option value="">Choose an image to add…</option>
            {project.assets
              .filter((asset) => asset.kind === "image")
              .map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
          </select>
        </Field>
      )}
      <div className="panel-divider" />
      <h3 className="panel-section">
        LAYERS <span>{project.edits.overlays.length}</span>
      </h3>
      {!project.edits.overlays.length && (
        <p className="helper">
          Your layers will appear here. Select a timeline range to add your first layer.
        </p>
      )}
      <div className="layers-list">
        {project.edits.overlays.map((o) => (
          <div key={o.id} className={selected === o.id ? "selected" : ""}>
            <button onClick={() => onSelect(o.id)}>
              {o.kind === "text" ? <Type size={14} /> : <ImagePlus size={14} />}
              <span>
                {o.kind === "text"
                  ? o.text
                  : o.kind === "image"
                    ? project.assets.find((a) => a.id === o.assetId)?.name || "Image"
                    : o.kind}
                <small>
                  {seconds(o.startMs)} – {seconds(o.endMs)}s · source
                </small>
              </span>
            </button>
            <IconButton
              label="Remove layer"
              onClick={() => void apply([{ type: "overlay.remove", id: o.id }])}
            >
              <Trash2 size={13} />
            </IconButton>
          </div>
        ))}
      </div>
      {overlay && (
        <div className="layer-properties" key={overlay.id}>
          <h3 className="panel-section">LAYER PROPERTIES</h3>
          {overlay.kind === "text" && (
            <>
              <Field label="Content">
                <textarea
                  defaultValue={overlay.text}
                  onBlur={(e) => {
                    if (e.target.value !== overlay.text) update({ text: e.target.value });
                  }}
                />
              </Field>
              <div className="two-columns">
                <Field label="Font size">
                  <input
                    type="number"
                    min={12}
                    max={200}
                    defaultValue={overlay.fontSize}
                    onBlur={(e) => update({ fontSize: number(e.target.value) })}
                  />
                </Field>
                <Field label="Color">
                  <input
                    type="color"
                    value={overlay.color}
                    onChange={(e) => update({ color: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}
          <Slider
            label="Horizontal position"
            value={overlay.x}
            onPreview={(x) => preview({ x })}
            onChange={(x) => update({ x })}
          />
          <Slider
            label="Vertical position"
            value={overlay.y}
            onPreview={(y) => preview({ y })}
            onChange={(y) => update({ y })}
          />
          <Slider
            label="Width"
            min={0.05}
            max={1}
            value={overlay.width}
            onPreview={(width) => preview({ width })}
            onChange={(width) => update({ width })}
          />
          {["arrow", "blur", "redact"].includes(overlay.kind) && (
            <Slider
              label="Height"
              min={0.02}
              max={1}
              value={overlay.height ?? 0.15}
              onPreview={(height) => preview({ height })}
              onChange={(height) => update({ height })}
            />
          )}
          {overlay.kind === "arrow" && (
            <Slider
              label="Arrow direction"
              suffix="°"
              min={0}
              max={360}
              step={15}
              value={overlay.rotation ?? 0}
              onPreview={(rotation) => preview({ rotation })}
              onChange={(rotation) => update({ rotation })}
            />
          )}
          {overlay.kind === "blur" && (
            <Slider
              label="Blur strength"
              suffix="px"
              min={4}
              max={100}
              step={1}
              value={overlay.blur ?? 30}
              onPreview={(blur) => preview({ blur })}
              onChange={(blur) => update({ blur })}
            />
          )}
          {["arrow", "redact"].includes(overlay.kind) && (
            <Field label="Layer color">
              <input
                type="color"
                value={overlay.color.slice(0, 7)}
                onChange={(e) => update({ color: e.target.value })}
              />
            </Field>
          )}
          {!["blur", "redact"].includes(overlay.kind) && (
            <Field label="Animation">
              <select
                value={overlay.animation}
                onChange={(e) => update({ animation: e.target.value as Overlay["animation"] })}
              >
                <option value="none">None</option>
                <option value="fade">Fade</option>
                <option value="slide">Slide in</option>
              </select>
            </Field>
          )}
          <button
            className="button secondary full"
            disabled={selection.endMs <= selection.startMs}
            onClick={() => update(selection)}
          >
            Use selected time range
          </button>
        </div>
      )}
    </>
  );
}
