import { useState } from "react";
import { ArrowDownToLine, FileVideo, FolderOpen } from "lucide-react";
import { type Project } from "@/shared/types";
import { duration, formatTime, outputSize } from "@/shared/timeline";
import { messageOf } from "@/src/lib/errors";
import { Field } from "@/src/components/molecules/Field";
import { Dialog } from "@/src/components/organisms/Dialog";

export function ExportDialog({
  project,
  busy,
  onClose,
  onExport,
  onError,
}: {
  project: Project;
  busy: boolean;
  onClose: () => void;
  onExport: (size: { width: number; height: number }) => Promise<void>;
  onError: (error: string) => void;
}) {
  const [resolution, setResolution] = useState("1080");
  return (
    <Dialog
      title="Ready for the world."
      subtitle="Export a polished video. Your project stays editable."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onExport(
            outputSize(project, resolution === "4k" ? "4k" : resolution === "720" ? "720" : "1080"),
          ).catch((e) => onError(messageOf(e)));
        }}
      >
        <div className="export-summary">
          <span>
            <FileVideo size={27} />
          </span>
          <div>
            <strong>{project.name}</strong>
            <p>{formatTime(duration(project.edits.segments))} · MP4 · H.264 / AAC</p>
          </div>
        </div>
        <Field label="Resolution">
          <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
            <option value="720">
              720p · {outputSize(project, "720").width} × {outputSize(project, "720").height}
            </option>
            <option value="1080">
              1080p · {outputSize(project).width} × {outputSize(project).height}
            </option>
            <option value="4k">
              4K · {outputSize(project, "4k").width} × {outputSize(project, "4k").height}
            </option>
          </select>
        </Field>
        <div className="export-details">
          <span>
            Frame rate<strong>30 fps</strong>
          </span>
          <span>
            Color<strong>SDR</strong>
          </span>
          <span>
            Subtitles
            <strong>{project.edits.captions.enabled ? "Burned into video" : "Off"}</strong>
          </span>
        </div>
        <div className="dialog-note">
          <FolderOpen size={16} />
          <span>Choose a destination outside your project to keep exports independent.</span>
        </div>
        <div className="dialog-actions">
          <button type="button" className="button subtle" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            <ArrowDownToLine size={15} />
            Choose location & export
          </button>
        </div>
      </form>
    </Dialog>
  );
}
