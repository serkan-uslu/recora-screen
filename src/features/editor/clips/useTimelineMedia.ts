import { useEffect, useRef, useState } from "react";
import { command } from "@/src/api";
import {
  timelineMediaSchema,
  type TimelineMedia,
  type TimelineMediaRange,
} from "@/shared/timelineMedia";

const cache = new Map<string, Promise<TimelineMedia>>();

export function useTimelineMedia(
  { projectId, assetId, startMs, endMs }: TimelineMediaRange,
  kind: "filmstrip" | "waveform",
) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<{ key: string; media?: TimelineMedia; failed?: boolean }>();
  const key = JSON.stringify([projectId, assetId, startMs, endMs, kind]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible(entries.some((entry) => entry.isIntersecting));
      },
      { rootMargin: "200px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || endMs <= startMs) return;
    let active = true;
    const timer = window.setTimeout(() => {
      let pending = cache.get(key);
      if (!pending) {
        pending = command("preview.media", { projectId, assetId, startMs, endMs, kind }).then(
          (value) => timelineMediaSchema.parse(value),
        );
        cache.set(key, pending);
        if (cache.size > 96) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
      }
      pending
        .then((media) => {
          if (active) setResult({ key, media });
        })
        .catch(() => {
          cache.delete(key);
          if (active) setResult({ key, failed: true });
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [projectId, assetId, startMs, endMs, kind, key, visible]);
  return {
    ref,
    media: result?.key === key ? result.media : undefined,
    failed: result?.key === key && result.failed,
  };
}
