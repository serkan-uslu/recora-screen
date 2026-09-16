import type { MouseEventHandler } from "react";
import { Camera, EyeOff } from "lucide-react";
import type { Project, Range } from "@/shared/types";
import { outputRanges } from "@/shared/timeline";

export function CameraTrack({
  project,
  ratio,
  onContextMenu,
  selected,
  onSelect,
  disabled,
}: {
  project: Project;
  ratio: (value: number) => string;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
  selected: Range | null;
  onSelect: (range: Range) => void;
  disabled: boolean;
}) {
  return (
    <div className="track" onContextMenu={onContextMenu}>
      {project.source?.camera && (
        <>
          {outputRanges(project.edits.segments, {
            startMs: 0,
            endMs: project.source.durationMs,
          }).map((range, index) => (
            <button
              key={index}
              aria-label={`Camera clip ${index + 1}`}
              aria-pressed={selected?.startMs === range.startMs && selected.endMs === range.endMs}
              disabled={disabled}
              onClick={() => onSelect(range)}
              onContextMenu={() => onSelect(range)}
              className={`clip camera-clip ${selected?.startMs === range.startMs && selected.endMs === range.endMs ? "selected" : ""}`}
              style={{
                left: ratio(range.startMs),
                width: ratio(range.endMs - range.startMs),
                opacity: project.edits.camera.visible ? 1 : 0.25,
              }}
            >
              <Camera size={12} />
              <span>Camera</span>
            </button>
          ))}
          {project.edits.camera.hiddenRanges
            .flatMap((range) => outputRanges(project.edits.segments, range))
            .map((range, index) => (
              <div
                key={index}
                className="camera-hidden"
                style={{
                  left: ratio(range.startMs),
                  width: ratio(range.endMs - range.startMs),
                }}
                title="Camera hidden"
              >
                <EyeOff size={12} />
              </div>
            ))}
        </>
      )}
    </div>
  );
}
