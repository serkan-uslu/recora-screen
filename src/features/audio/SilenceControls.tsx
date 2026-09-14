import { Sparkles } from "lucide-react";
import { Field } from "@/src/components/molecules/Field";

export function SilenceControls({
  disabled,
  onAnalyze,
}: {
  disabled: boolean;
  onAnalyze: (params: Record<string, number | boolean>) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        onAnalyze({
          thresholdDb: Number(data.get("threshold")),
          minSilenceMs: Number(data.get("duration")),
          paddingMs: Number(data.get("padding")),
          preserveSystemAudio: data.get("preserve") === "on",
        });
      }}
    >
      <div className="two-columns">
        <Field label="Quiet threshold">
          <input name="threshold" type="number" min={-80} max={-10} step={1} defaultValue={-40} />
          <small>dB</small>
        </Field>
        <Field label="Minimum pause">
          <input
            name="duration"
            type="number"
            min={200}
            max={10000}
            step={100}
            defaultValue={700}
          />
          <small>milliseconds</small>
        </Field>
      </div>
      <Field label="Speech padding (ms)">
        <input type="number" name="padding" min={0} max={1000} step={50} defaultValue={150} />
      </Field>
      <label className="check-row">
        <input type="checkbox" name="preserve" defaultChecked />
        Keep pauses with system audio
      </label>
      <button className="button secondary full" disabled={disabled}>
        <Sparkles size={15} />
        Analyze quiet moments
      </button>
    </form>
  );
}
