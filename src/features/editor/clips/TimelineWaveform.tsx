import type { TimelineMediaRange } from "@/shared/timelineMedia";
import { useTimelineMedia } from "@/src/features/editor/clips/useTimelineMedia";
import "@/src/features/editor/clips/media.css";

export function TimelineWaveform({
  volume = 1,
  microphoneVolume = 1,
  systemVolume = 1,
  ...range
}: TimelineMediaRange & { volume?: number; microphoneVolume?: number; systemVolume?: number }) {
  const { ref, media, failed } = useTimelineMedia(range, "waveform");
  const levels = Array.from({ length: 256 }, (_, index) =>
    Math.min(
      1,
      (media?.channels ?? []).reduce(
        (total, channel) =>
          total +
          (channel.levels[index] ?? 0) *
            (channel.kind === "microphone"
              ? microphoneVolume
              : channel.kind === "system"
                ? systemVolume
                : volume),
        0,
      ),
    ),
  );
  const path = levels
    .map((level, index) => {
      const height = Math.min(15, Math.sqrt(level) * 26);
      return `M${index + 0.5},${16 - height}v${height * 2}`;
    })
    .join(" ");
  return (
    <span
      ref={ref}
      className="timeline-waveform"
      aria-hidden="true"
      title={failed ? "Waveform unavailable" : "Audio levels from this clip"}
    >
      {media && media.channels.some((channel) => channel.levels.length > 0) && (
        <svg viewBox="0 0 256 32" preserveAspectRatio="none">
          <path d={path} />
        </svg>
      )}
    </span>
  );
}
