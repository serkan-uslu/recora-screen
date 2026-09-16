import { useMemo } from "react";
import type { Project, Range, TimelineSegment } from "@/shared/types";
import { segmentDuration, subtractRanges } from "@/shared/timeline";

export type TimelineInterval = TimelineSegment & {
  index: number;
  outputStart: number;
  outputEnd: number;
  name: string;
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
        name: segment.assetId
          ? (project.assets.find((asset) => asset.id === segment.assetId)?.name ?? "Imported media")
          : "Screen",
      };
      offset = interval.outputEnd;
      return interval;
    });
    const selectedClip = intervals.findIndex(
      (interval) =>
        Math.abs(interval.outputStart - selection.startMs) < 0.1 &&
        Math.abs(interval.outputEnd - selection.endMs) < 0.1,
    );
    const originals = intervals.filter((interval) => !interval.assetId);
    const gaps: TimelineGap[] = subtractRanges(
      project.source ? [{ startMs: 0, endMs: project.source.durationMs }] : [],
      originals,
    ).map((gap) => ({
      ...gap,
      outputMs:
        originals.find((interval) => Math.abs(interval.startMs - gap.endMs) < 0.01)?.outputStart ??
        originals.find((interval) => Math.abs(interval.endMs - gap.startMs) < 0.01)?.outputEnd ??
        total,
    }));
    const ratio = (value: number) =>
      total ? `${Math.max(0, Math.min(100, (value / total) * 100))}%` : "0%";
    return { intervals, gaps, selectedClip, ratio };
  }, [
    project.assets,
    project.edits.segments,
    project.source,
    selection.endMs,
    selection.startMs,
    total,
  ]);
}
