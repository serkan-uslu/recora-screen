import { useContext } from "react";
import type { AudioClip, EditOperation, Project, Range } from "@/shared/types";
import { duration } from "@/shared/timeline";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { Field } from "@/src/components/molecules/Field";
import { Slider } from "@/src/components/molecules/Slider";
import { messageOf } from "@/src/lib/errors";

export function AudioClipsPanel({
  selectedId,
  onSelect,
  project,
  selection,
  apply,
  importAudio,
  onError,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  project: Project;
  selection: Range;
  apply: (ops: EditOperation[], revision?: number) => Promise<void>;
  importAudio: () => Promise<
    { asset: Project["assets"][number] | undefined; revision: number } | undefined
  >;
  onError: (message: string) => void;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const add = async () => {
    try {
      const result = await importAudio();
      if (!result?.asset?.durationMs) return;
      const endMs = Math.min(selection.endMs, selection.startMs + result.asset.durationMs);
      await apply(
        [
          {
            type: "audioClip.add",
            clip: {
              assetId: result.asset.id,
              startMs: selection.startMs,
              endMs,
              offsetMs: 0,
              volume: 1,
            },
          },
        ],
        result.revision,
      );
    } catch (error) {
      onError(messageOf(error));
    }
  };
  const update = (id: string, clip: Partial<AudioClip>) =>
    void apply([{ type: "audioClip.update", id, clip }]);
  return (
    <>
      <h3 className="panel-section">IMPORTED AUDIO</h3>
      <button
        className="button secondary full"
        disabled={!project.source || selection.endMs <= selection.startMs}
        onClick={() => void add()}
      >
        Add audio to selection
      </button>
      <p className="helper">
        MP3, WAV, M4A, AAC, AIFF or CAF, up to 500 MB. Imported audio stays at its output time when
        screen clips are cut or retimed. Playback stops at the video end.
      </p>
      {(project.edits.audioClips ?? [])
        .filter((clip) => !selectedId || clip.id === selectedId)
        .map((clip) => (
          <div className="review-card" key={clip.id}>
            <button
              className="audio-clip-heading"
              aria-pressed={selectedId === clip.id}
              onClick={() => onSelect(clip.id)}
            >
              {project.assets.find((asset) => asset.id === clip.assetId)?.name ?? "Audio"}
            </button>
            {clip.startMs >= duration(project.edits.segments) && (
              <p className="helper">Outside the current video. Move this clip to hear it.</p>
            )}
            <form
              key={`${clip.startMs}:${clip.endMs}:${clip.offsetMs}`}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                update(clip.id, {
                  startMs: Number(data.get("start")) * 1000,
                  endMs: Number(data.get("end")) * 1000,
                  offsetMs: Number(data.get("offset")) * 1000,
                });
              }}
            >
              <div className="two-columns">
                <Field label="Start (seconds)">
                  <input
                    name="start"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={clip.startMs / 1000}
                  />
                </Field>
                <Field label="End (seconds)">
                  <input
                    name="end"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={clip.endMs / 1000}
                  />
                </Field>
              </div>
              <Field label="Skip into audio (seconds)">
                <input
                  name="offset"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  defaultValue={clip.offsetMs / 1000}
                />
              </Field>
              <button className="button secondary full">Apply audio timing</button>
            </form>
            <Slider
              label="Clip volume"
              value={clip.volume}
              max={2}
              onPreview={(volume) =>
                draftPreview([{ type: "audioClip.update", id: clip.id, clip: { volume } }])
              }
              onChange={(volume) => update(clip.id, { volume })}
            />
            <button
              className="button subtle full"
              onClick={() => void apply([{ type: "audioClip.remove", id: clip.id }])}
            >
              Remove audio clip
            </button>
          </div>
        ))}
      <div className="panel-divider" />
    </>
  );
}
