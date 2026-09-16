import { useState } from "react";
import { ArrowDownToLine, FileVideo, FolderOpen } from "lucide-react";
import { type ExportOptions, type Project } from "@/shared/types";
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
  onExport: (size: ExportOptions) => Promise<void>;
  onError: (error: string) => void;
}) {
  const [resolution, setResolution] = useState("1080");
  const [format, setFormat] = useState<"mp4" | "gif">("mp4");
  const [gifFps, setGifFps] = useState<15 | 20 | 25 | 30>(15);
  const [loop, setLoop] = useState(true);
  const [gifEdge, setGifEdge] = useState(640);
  const base = outputSize(project, "720");
  const gifScale = gifEdge / Math.max(base.width, base.height);
  const gifSize = {
    width: Math.max(16, Math.round((base.width * gifScale) / 2) * 2),
    height: Math.max(16, Math.round((base.height * gifScale) / 2) * 2),
  };
  const gifTooLong = format === "gif" && duration(project.edits.segments) > 60000;
  return (
    <Dialog
      title="Ready for the world."
      subtitle="Export a polished video. Your project stays editable."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onExport({
            ...(format === "gif"
              ? gifSize
              : outputSize(
                  project,
                  resolution === "4k" ? "4k" : resolution === "720" ? "720" : "1080",
                )),
            format,
            gifFps,
            loop,
          }).catch((e) => onError(messageOf(e)));
        }}
      >
        <div className="export-summary">
          <span>
            <FileVideo size={27} />
          </span>
          <div>
            <strong>{project.name}</strong>
            <p>
              {formatTime(duration(project.edits.segments))} ·{" "}
              {format === "gif" ? "GIF · no audio" : "MP4 · H.264 / AAC"}
            </p>
          </div>
        </div>
        <Field label="Format">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value === "gif" ? "gif" : "mp4")}
          >
            <option value="mp4">MP4 video</option>
            <option value="gif">Animated GIF</option>
          </select>
        </Field>
        {format === "gif" ? (
          <>
            <Field label="GIF size">
              <select value={gifEdge} onChange={(e) => setGifEdge(Number(e.target.value))}>
                <option value={640}>640 pixels, longest edge</option>
                <option value={1280}>1280 pixels, longest edge</option>
              </select>
            </Field>
            <Field label="GIF frame rate">
              <select
                value={gifFps}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value === 15 || value === 20 || value === 25 || value === 30)
                    setGifFps(value);
                }}
              >
                {[15, 20, 25, 30].map((fps) => (
                  <option key={fps} value={fps}>
                    {fps} FPS
                  </option>
                ))}
              </select>
            </Field>
            <label>
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />{" "}
              Loop continuously
            </label>
            <p className="helper">
              GIF has no audio and supports videos up to 60 seconds. Trim a longer video or choose
              MP4.
            </p>
            {gifTooLong && <p role="alert">Trim the timeline to 60 seconds or less for GIF.</p>}
          </>
        ) : (
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
        )}
        <div className="export-details">
          <span>
            Frame rate<strong>{format === "gif" ? gifFps : 30} fps</strong>
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
          <button className="button primary" disabled={busy || gifTooLong}>
            <ArrowDownToLine size={15} />
            Choose location & export
          </button>
        </div>
      </form>
    </Dialog>
  );
}
