import { useEffect, useState } from "react";
import type { TimelineMediaRange } from "@/shared/timelineMedia";
import { useTimelineMedia } from "@/src/features/editor/clips/useTimelineMedia";
import "@/src/features/editor/clips/media.css";

export function TimelineFilmstrip(props: TimelineMediaRange) {
  const { ref, media, failed } = useTimelineMedia(props, "filmstrip");
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setColumns(Math.max(1, Math.min(8, Math.ceil((entries[0]?.contentRect.width ?? 0) / 80))));
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  const samples = media?.frames ?? [];
  const count = Math.min(columns, samples.length);
  const frames = Array.from(
    { length: count },
    (_, index) =>
      samples[Math.min(samples.length - 1, Math.floor(((index + 0.5) * samples.length) / count))],
  );
  return (
    <span
      ref={ref}
      className="timeline-filmstrip"
      aria-hidden="true"
      title={failed ? "Thumbnails unavailable" : "Frames from this clip"}
    >
      {frames.map((frame, index) => (
        <img key={index} src={frame.src} data-source-ms={frame.timeMs} alt="" draggable={false} />
      ))}
    </span>
  );
}
