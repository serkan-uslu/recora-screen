import type { MouseEventHandler } from "react";
import { AudioLines } from "lucide-react";
import type { Project } from "@/shared/types";

export function AudioTrack({
  project,
  onContextMenu,
}: {
  project: Project;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <div className="track" onContextMenu={onContextMenu}>
      {(project.source?.microphone || project.source?.systemAudio) && (
        <div className="clip audio-clip" style={{ width: "100%" }}>
          <AudioLines size={13} />
          <span>
            {[
              project.source.microphone && "Microphone",
              project.source.systemAudio && "System audio",
            ]
              .filter(Boolean)
              .join(" + ")}
          </span>
          <span className="audio-track-line" />
        </div>
      )}
    </div>
  );
}
