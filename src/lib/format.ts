import { type RecordingStatus } from "@/shared/types";

export const idleRecording: RecordingStatus = {
  active: false,
  paused: false,
  durationMs: 0,
  microphoneLevel: 0,
  systemLevel: 0,
  cameraVisible: true,
  cameraEnabled: true,
};
export const number = (value: string) => (Number.isFinite(Number(value)) ? Number(value) : 0);
export const seconds = (ms: number) => (ms / 1000).toFixed(2);
export const date = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

export const formatTimecode = (ms: number) => {
  const centiseconds = Math.floor(Math.max(0, ms) / 10);
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
};
