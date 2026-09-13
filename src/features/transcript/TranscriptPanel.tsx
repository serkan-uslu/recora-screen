import { DraftPreviewContext } from "../../controllers/StudioContexts";
import { useContext } from "react";
import { Download, Scissors, Sparkles } from "lucide-react";
import {
  type EditOperation,
  type Project,
  type Range,
  type TranscriptSegment,
} from "../../../shared/types";
import { formatTime, outputRanges } from "../../../shared/timeline";
import { Field } from "../../components/molecules/Field";
import { Switch } from "../../components/atoms/Switch";
import { Slider } from "../../components/molecules/Slider";
import { PanelIntro } from "../../components/molecules/PanelIntro";
import { type Settings } from "../../controllers/studioTypes";

export function TranscriptPanel({
  project,
  settings,
  apply,
  onJob,
  onSelect,
  onExport,
}: {
  project: Project;
  settings: Settings | null;
  apply: (ops: EditOperation[]) => Promise<void>;
  onJob: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  onSelect: (range: Range) => void;
  onExport: (format: "srt" | "vtt") => void;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const captions = project.edits.captions;
  const rangeFor = (segment: TranscriptSegment) => {
    const ranges = outputRanges(project.edits.segments, segment);
    return ranges.length
      ? { startMs: ranges[0]!.startMs, endMs: ranges.at(-1)!.endMs }
      : null;
  };
  return (
    <>
      <PanelIntro
        title="Every word, right where it belongs."
        text="Transcribe on your device, then edit your video through its words."
      />
      <button
        className="button secondary full"
        disabled={!project.source}
        onClick={() =>
          void onJob("ai.transcribe", {
            model: settings?.transcriptionModel || "small",
            language: settings?.language || "auto",
          })
        }
      >
        <Sparkles size={15} />
        {project.transcript.length
          ? "Regenerate transcript"
          : "Generate transcript"}
      </button>
      <p className="helper">
        Uses a downloaded Whisper model. Your audio stays on your device.
      </p>
      <Switch
        label="Show subtitles in video"
        checked={captions.enabled}
        onChange={(enabled) =>
          void apply([{ type: "captions.update", settings: { enabled } }])
        }
      />
      {captions.enabled && (
        <>
          <Slider
            label="Subtitle size"
            min={16}
            max={96}
            step={1}
            suffix=" px"
            value={captions.fontSize}
            onPreview={fontSize => draftPreview([{ type: "captions.update", settings: { fontSize } }])}
            onChange={(fontSize) =>
              void apply([{ type: "captions.update", settings: { fontSize } }])
            }
          />
          <div className="two-columns">
            <Field label="Text color">
              <input
                type="color"
                value={captions.color}
                onChange={(e) =>
                  void apply([
                    {
                      type: "captions.update",
                      settings: { color: e.target.value },
                    },
                  ])
                }
              />
            </Field>
            <Field label="Background">
              <input
                type="color"
                value={captions.background}
                onChange={(e) =>
                  void apply([
                    {
                      type: "captions.update",
                      settings: { background: e.target.value },
                    },
                  ])
                }
              />
            </Field>
          </div>
        </>
      )}
      {project.transcript.length > 0 && (
        <div className="button-row">
          {(["srt", "vtt"] as const).map((format) => (
            <button
              key={format}
              className="button subtle"
              onClick={() => onExport(format)}
            >
              <Download size={13} />
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <div className="panel-divider" />
      <h3 className="panel-section">
        TRANSCRIPT <span>{project.transcript.length} segments</span>
      </h3>
      <div className="transcript-list">
        {project.transcript.map((segment) => {
          const range = rangeFor(segment);
          return (
            <div key={segment.id} className={!range ? "removed" : ""}>
              <button
                className="transcript-time"
                disabled={!range}
                onClick={() => range && onSelect(range)}
              >
                {formatTime(range?.startMs ?? segment.startMs)}
                <span>{range ? "Select" : "Cut"}</span>
              </button>
              <textarea
                aria-label={`Transcript at ${formatTime(segment.startMs)}`}
                defaultValue={segment.text}
                key={`${segment.id}-${segment.text}`}
                rows={Math.max(2, Math.ceil(segment.text.length / 36))}
                onBlur={(e) => {
                  if (e.target.value !== segment.text)
                    void apply([
                      {
                        type: "transcript.text",
                        id: segment.id,
                        text: e.target.value,
                      },
                    ]);
                }}
              />
              {range && (
                <button
                  className="transcript-cut"
                  onClick={() => void apply([{ type: "cut", ...range }])}
                >
                  <Scissors size={12} />
                  Cut this sentence
                </button>
              )}
            </div>
          );
        })}
        {!project.transcript.length && (
          <p className="helper">
            Your transcript will appear here after processing.
          </p>
        )}
      </div>
    </>
  );
}
