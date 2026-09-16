import type { MouseEventHandler } from "react";
import { AudioLines } from "lucide-react";
import { duration, segmentDuration } from "@/shared/timeline";
import type { Project, Range } from "@/shared/types";
import { TimelineWaveform } from "@/src/features/editor/clips/TimelineWaveform";

export function AudioTrack({
  project,
  onContextMenu,
  onSelect,
  onSelectRecorded,
  selectedId,
  selectedRange,
  disabled,
}: {
  project: Project;
  onSelect: (id: string, range: Range) => void;
  onSelectRecorded: (range: Range) => void;
  selectedId: string | null;
  selectedRange: Range | null;
  disabled: boolean;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
}) {
  const total = duration(project.edits.segments);
  let offset = 0;
  const clips = project.edits.segments.map((segment) => {
    const range = { startMs: offset, endMs: offset + segmentDuration(segment) };
    offset = range.endMs;
    return { segment, range };
  });
  return (
    <div className="track audio-track" onContextMenu={onContextMenu}>
      {clips.map(({ segment, range }, index) => {
        const asset = project.assets.find((asset) => asset.id === segment.assetId);
        if (
          segment.assetId
            ? asset?.kind !== "video"
            : !project.source?.microphone && !project.source?.systemAudio
        )
          return null;
        const selected =
          selectedRange?.startMs === range.startMs && selectedRange.endMs === range.endMs;
        const label =
          segment.assetId || project.source?.microphone === project.source?.screen
            ? "Video audio"
            : [
                project.source?.microphone && "Microphone",
                project.source?.systemAudio && "System audio",
              ]
                .filter(Boolean)
                .join(" + ");
        return (
          <button
            key={index}
            className={`clip audio-clip ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            disabled={disabled}
            aria-label={`${label} clip ${index + 1}`}
            onClick={() => onSelectRecorded(range)}
            style={{
              left: `${(100 * range.startMs) / total}%`,
              width: `${(100 * (range.endMs - range.startMs)) / total}%`,
            }}
          >
            <TimelineWaveform
              projectId={project.id}
              assetId={segment.assetId}
              startMs={segment.startMs}
              endMs={segment.endMs}
              microphoneVolume={project.edits.audio.microphoneVolume}
              systemVolume={project.edits.audio.systemVolume}
              volume={project.edits.audio.systemVolume}
            />
            <AudioLines size={13} />
            <span>{label}</span>
          </button>
        );
      })}
      {(project.edits.audioClips ?? [])
        .filter((clip) => clip.startMs < total)
        .map((clip) => (
          <button
            key={clip.id}
            className={`clip audio-clip imported-audio-clip ${selectedId === clip.id ? "selected" : ""}`}
            aria-pressed={selectedId === clip.id}
            disabled={disabled}
            title={
              project.assets.find((asset) => asset.id === clip.assetId)?.name ?? "Imported audio"
            }
            style={{
              left: `${(100 * clip.startMs) / total}%`,
              width: `${(100 * (Math.min(clip.endMs, total) - clip.startMs)) / total}%`,
            }}
            onClick={() =>
              onSelect(clip.id, { startMs: clip.startMs, endMs: Math.min(clip.endMs, total) })
            }
          >
            <TimelineWaveform
              projectId={project.id}
              assetId={clip.assetId}
              startMs={clip.offsetMs}
              endMs={clip.offsetMs + Math.min(clip.endMs, total) - clip.startMs}
              volume={clip.volume}
            />
            <AudioLines size={12} />
            <span>
              {project.assets.find((asset) => asset.id === clip.assetId)?.name ?? "Imported audio"}
            </span>
          </button>
        ))}
    </div>
  );
}
