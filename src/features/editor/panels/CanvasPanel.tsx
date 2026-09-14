import { useContext } from "react";
import { Check, ImagePlus } from "lucide-react";
import {
  type EditOperation,
  type Project,
  type CanvasSettings,
  defaultCanvas,
} from "@/shared/types";
import { messageOf } from "@/src/lib/errors";
import { Field } from "@/src/components/molecules/Field";
import { Slider } from "@/src/components/molecules/Slider";
import { PanelIntro } from "@/src/components/molecules/PanelIntro";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";

export function CanvasPanel({
  project,
  apply,
  importImage,
  onError,
}: {
  project: Project;
  apply: (ops: EditOperation[], revision?: number) => Promise<void>;
  importImage: () => Promise<
    { asset: Project["assets"][number] | undefined; revision: number } | undefined
  >;
  onError: (error: string) => void;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const preview = (settings: Partial<CanvasSettings>) =>
    draftPreview([{ type: "canvas.update", settings }]);
  const canvas =
    project.edits.canvas ??
    ({
      ...defaultCanvas(),
      aspectRatio: "source",
      background: "hidden",
      padding: 0,
      radius: 0,
      shadow: 0,
      frame: "none",
    } as CanvasSettings);
  const update = (settings: Partial<CanvasSettings>, revision?: number) =>
    void apply([{ type: "canvas.update", settings }], revision);
  return (
    <>
      <PanelIntro
        title="Give your screen some space."
        text="Frame your recording for the place you’ll share it."
      />
      <h3 className="panel-section">CANVAS</h3>
      <div className="aspect-options" role="group" aria-label="Canvas aspect ratio">
        {(["source", "16:9", "1:1", "9:16", "4:5"] as const).map((aspectRatio) => (
          <button
            key={aspectRatio}
            aria-pressed={canvas.aspectRatio === aspectRatio}
            className={canvas.aspectRatio === aspectRatio ? "selected" : ""}
            onClick={() => update({ aspectRatio })}
          >
            <span
              style={{
                aspectRatio: aspectRatio === "source" ? "16/10" : aspectRatio.replace(":", "/"),
              }}
            />
            {aspectRatio === "source" ? "Source" : aspectRatio}
          </button>
        ))}
      </div>
      <div className="panel-divider" />
      <h3 className="panel-section">BACKGROUND</h3>
      <div className="background-options" role="group" aria-label="Background type">
        {(["wallpaper", "gradient", "color", "image", "hidden"] as const).map((background) => (
          <button
            key={background}
            className={canvas.background === background ? "selected" : ""}
            aria-pressed={canvas.background === background}
            onClick={() => {
              if (background === "image" && !canvas.assetId) {
                void importImage()
                  .then((result) => {
                    if (result?.asset)
                      update({ background, assetId: result.asset.id }, result.revision);
                  })
                  .catch((e) => onError(messageOf(e)));
              } else update({ background });
            }}
          >
            {background === "hidden"
              ? "Hidden"
              : background[0]!.toUpperCase() + background.slice(1)}
          </button>
        ))}
      </div>
      {canvas.background === "wallpaper" && (
        <div className="wallpaper-options" role="group" aria-label="Wallpaper preset">
          {(["aurora", "sunset", "ocean", "dusk"] as const).map((wallpaper) => (
            <button
              className={`wallpaper-swatch ${wallpaper} ${canvas.wallpaper === wallpaper ? "selected" : ""}`}
              key={wallpaper}
              aria-pressed={canvas.wallpaper === wallpaper}
              onClick={() => update({ wallpaper })}
            >
              <span>{wallpaper[0]!.toUpperCase() + wallpaper.slice(1)}</span>
              {canvas.wallpaper === wallpaper && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
      {(canvas.background === "color" || canvas.background === "gradient") && (
        <div className="two-columns">
          <Field label={canvas.background === "gradient" ? "Start color" : "Color"}>
            <input
              type="color"
              value={canvas.color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </Field>
          {canvas.background === "gradient" && (
            <Field label="End color">
              <input
                type="color"
                value={canvas.gradientTo}
                onChange={(e) => update({ gradientTo: e.target.value })}
              />
            </Field>
          )}
        </div>
      )}
      {canvas.background === "gradient" && (
        <Slider
          label="Gradient angle"
          min={0}
          max={360}
          step={1}
          suffix="°"
          value={canvas.gradientAngle}
          onChange={(gradientAngle) => update({ gradientAngle })}
          onPreview={(gradientAngle) => preview({ gradientAngle })}
        />
      )}
      {canvas.background === "image" && (
        <>
          <Field label="Background image">
            <select
              value={canvas.assetId ?? ""}
              onChange={(e) => update({ assetId: e.target.value })}
            >
              <option value="" disabled>
                Select an image
              </option>
              {project.assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            className="button secondary full"
            onClick={() =>
              void importImage()
                .then((result) => {
                  if (result?.asset) update({ assetId: result.asset.id }, result.revision);
                })
                .catch((e) => onError(messageOf(e)))
            }
          >
            <ImagePlus size={14} />
            Import background image
          </button>
        </>
      )}
      {["gradient", "wallpaper", "image"].includes(canvas.background) && (
        <Slider
          label="Background blur"
          min={0}
          max={60}
          step={1}
          suffix=" px"
          value={canvas.blur}
          onChange={(blur) => update({ blur })}
          onPreview={(blur) => preview({ blur })}
        />
      )}
      {canvas.background === "hidden" && (
        <p className="helper">A plain canvas without a decorative background.</p>
      )}
      <div className="panel-divider" />
      <h3 className="panel-section">SCREEN FRAME</h3>
      <Field label="Frame style">
        <select
          value={canvas.frame}
          onChange={(e) => update({ frame: e.target.value as CanvasSettings["frame"] })}
        >
          <option value="none">Hidden</option>
          <option value="minimal">Minimal</option>
          <option value="browser">Browser</option>
        </select>
      </Field>
      {canvas.frame === "browser" && (
        <Field label="Window title">
          <input
            key={`${project.id}-${canvas.title}`}
            defaultValue={canvas.title}
            placeholder={project.source?.title ?? project.name}
            maxLength={200}
            onBlur={(e) => {
              if (e.target.value !== canvas.title) update({ title: e.target.value });
            }}
          />
        </Field>
      )}
      <Slider
        label="Padding"
        max={0.2}
        value={canvas.padding}
        onChange={(padding) => update({ padding })}
        onPreview={(padding) => preview({ padding })}
      />
      <Slider
        label="Corner radius"
        max={0.1}
        step={0.005}
        value={canvas.radius}
        onChange={(radius) => update({ radius })}
        onPreview={(radius) => preview({ radius })}
      />
      <Slider
        label="Shadow"
        value={canvas.shadow}
        onChange={(shadow) => update({ shadow })}
        onPreview={(shadow) => preview({ shadow })}
      />
    </>
  );
}
