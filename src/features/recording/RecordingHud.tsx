import { Camera, EyeOff, Mic, Pause, Play, Square, Video } from "lucide-react";
import { formatTime } from "@/shared/timeline";
import { IconButton } from "@/src/components/atoms/IconButton";
import { type StudioController } from "@/src/controllers/useStudioController";

export function RecordingHud({
  studio,
}: {
  studio: Pick<
    StudioController,
    | "recording"
    | "recordingBusy"
    | "toggleCameraVisibility"
    | "toggleCameraDevice"
    | "toggleRecordingPause"
    | "finishRecording"
  >;
}) {
  const {
    recording,
    recordingBusy,
    toggleCameraVisibility,
    toggleCameraDevice,
    toggleRecordingPause,
    finishRecording,
  } = studio;

  return (
    <div className="recording-hud" role="status">
      <div className={`record-dot ${recording.paused ? "paused" : ""}`} />
      <div className="recording-clock">
        {formatTime(recording.durationMs)}
        <small>
          {recording.phase === "starting"
            ? "Starting…"
            : recording.phase === "finalizing"
              ? "Finalizing…"
              : recording.paused
                ? "Paused"
                : "Recording"}
        </small>
      </div>
      <div className="audio-meter" title="Microphone level">
        <Mic size={14} />
        <meter min={0} max={1} value={recording.microphoneLevel} aria-label="Microphone level" />
      </div>
      {recording.monitoring && (
        <span
          className="monitor-status"
          title={
            recording.monitoring.message ||
            "Only interaction timing is stored. Typed text is never recorded."
          }
        >
          Pointer: {recording.monitoring.pointer} · Input: {recording.monitoring.input}
        </span>
      )}
      <IconButton
        label={recording.cameraVisible ? "Hide camera" : "Show camera"}
        disabled={recordingBusy}
        onClick={toggleCameraVisibility}
      >
        {recording.cameraVisible ? <Camera /> : <EyeOff />}
      </IconButton>
      <IconButton
        label={
          recording.cameraEnabled
            ? "Turn camera device off (this interval cannot be restored)"
            : "Turn camera device on"
        }
        disabled={recordingBusy}
        onClick={toggleCameraDevice}
      >
        <Video className={recording.cameraEnabled ? "" : "muted"} />
      </IconButton>
      <IconButton
        label={recording.paused ? "Resume recording" : "Pause recording"}
        disabled={recordingBusy}
        onClick={toggleRecordingPause}
      >
        {recording.paused ? <Play /> : <Pause />}
      </IconButton>
      <button className="button recording-stop" disabled={recordingBusy} onClick={finishRecording}>
        <Square size={12} fill="currentColor" />
        {recording.phase === "finalizing" ? "Finalizing…" : "Finish"}
      </button>
    </div>
  );
}
