import { useMemo } from "react";
import type { Project, Range, TimelineSegment } from "@/shared/types";
import { segmentDuration } from "@/shared/timeline";

export type TimelineInterval = TimelineSegment & {
  index: number;
  outputStart: number;
  outputEnd: number;
};

export type TimelineGap = Range & { outputMs: number };

export function useTimelineGeometry(project: Project, total: number, selection: Range) {
  return useMemo(() => {
    let offset = 0;
    const intervals: TimelineInterval[] = project.edits.segments.map((segment, index) => {
      const interval = {
        ...segment,
        index,
        outputStart: offset,
        outputEnd: offset + segmentDuration(segment),
      };
      offset = interval.outputEnd;
      return interval;
    });
    const selectedClip = intervals.findIndex(
      (interval) =>
        Math.abs(interval.outputStart - selection.startMs) < 0.1 &&
        Math.abs(interval.outputEnd - selection.endMs) < 0.1,
    );
    const gaps: TimelineGap[] = [];
    let lastSource = 0;
    let outputMs = 0;
    for (const interval of intervals) {
      if (interval.startMs > lastSource)
        gaps.push({ startMs: lastSource, endMs: interval.startMs, outputMs });
      lastSource = interval.endMs;
      outputMs = interval.outputEnd;
    }
    if (project.source && lastSource < project.source.durationMs)
      gaps.push({ startMs: lastSource, endMs: project.source.durationMs, outputMs: total });
    const ratio = (value: number) =>
      total ? `${Math.max(0, Math.min(100, (value / total) * 100))}%` : "0%";
    return { intervals, gaps, selectedClip, ratio };
  }, [project.edits.segments, project.source, selection.endMs, selection.startMs, total]);
}
