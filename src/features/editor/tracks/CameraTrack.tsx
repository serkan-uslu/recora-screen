import type { MouseEventHandler } from "react";
import { Camera, EyeOff } from "lucide-react";
import type { Project } from "@/shared/types";
import { outputRanges } from "@/shared/timeline";

export function CameraTrack({
  project,
  ratio,
  onContextMenu,
}: {
  project: Project;
  ratio: (value: number) => string;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <div className="track" onContextMenu={onContextMenu}>
      {project.source?.camera && (
        <>
          <div
            className="clip camera-clip"
            style={{ width: "100%", opacity: project.edits.camera.visible ? 1 : 0.25 }}
          >
            <Camera size={12} />
            <span>Camera</span>
          </div>
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
