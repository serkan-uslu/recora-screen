export type Range = { startMs: number; endMs: number };
export type TimelineSegment = Range & { speed?: number };
export const mcpPermissionCategories = [
  "read",
  "edit",
  "export",
  "recording",
  "sensitive",
  "destructive",
] as const;
export type McpPermissionCategory = (typeof mcpPermissionCategories)[number];
export type McpPermissions = Record<McpPermissionCategory, boolean>;
export const defaultMcpPermissions: McpPermissions = {
  read: true,
  edit: true,
  export: true,
  recording: false,
  sensitive: false,
  destructive: false,
};
type CaptureSource = {
  id: string;
  name: string;
  kind: "display" | "window";
  width: number;
  height: number;
};
type Device = { id: string; name: string };
export type CaptureSettings = {
  sourceId: string;
  sourceKind: "display" | "window";
  region?: { x: number; y: number; width: number; height: number };
  cameraId?: string;
  microphoneId?: string;
  systemAudio: boolean;
  cameraShape: "circle" | "square";
  width: number;
  height: number;
  fps: 30;
};
export type RecordingSource = {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  screen: string;
  camera?: string;
  microphone?: string;
  systemAudio?: string;
  cursor?: string;
  cameraActiveRanges?: Range[];
  title?: string;
};
export type CursorEvent = {
  tMs: number;
  x: number;
  y: number;
  click?: boolean;
  kind?: "click" | "drag" | "typing";
};
export type CameraLayoutSettings = {
  shape: "circle" | "square";
  x: number;
  y: number;
  size: number;
  shadow: boolean;
};
export type CameraLayout = CameraLayoutSettings & Range & { id: string };
type CameraSettings = CameraLayoutSettings & {
  visible: boolean;
  hiddenRanges: Range[];
  layouts: CameraLayout[];
};
type ZoomMotion = "gentle" | "snappy";
export type Zoom = Range & {
  id: string;
  scale: number;
  x: number;
  y: number;
  motion?: ZoomMotion;
  followCursor?: boolean;
};
export type AutoZoomSettings = {
  enabled: boolean;
  scale: number;
  leadMs: number;
  holdMs: number;
  gapMs: number;
  motion: ZoomMotion;
  followCursor: boolean;
};
export type CanvasSettings = {
  aspectRatio: "source" | "16:9" | "9:16" | "1:1" | "4:5";
  background: "hidden" | "color" | "gradient" | "wallpaper" | "image";
  color: string;
  gradientTo: string;
  gradientAngle: number;
  wallpaper: "aurora" | "sunset" | "ocean" | "dusk";
  assetId?: string;
  blur: number;
  padding: number;
  radius: number;
  shadow: number;
  frame: "none" | "minimal" | "browser";
  title: string;
};
export type Overlay = Range & {
  id: string;
  kind: "text" | "image";
  text?: string;
  assetId?: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  color: string;
  animation: "none" | "fade" | "slide";
};
export type TranscriptSegment = Range & { id: string; text: string };
type Asset = { id: string; name: string; path: string; kind: "image" };
export type EditState = {
  segments: TimelineSegment[];
  camera: CameraSettings;
  zooms: Zoom[];
  overlays: Overlay[];
  canvas?: CanvasSettings;
  autoZoom?: AutoZoomSettings;
  audio: { microphoneVolume: number; systemVolume: number };
  cursor: { visible: boolean; highlight: boolean; smooth: boolean; size: number };
  captions: { enabled: boolean; fontSize: number; color: string; background: string };
};
export type Project = {
  schemaVersion: 2;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  status: "draft" | "recording" | "ready";
  source?: RecordingSource;
  edits: EditState;
  transcript: TranscriptSegment[];
  assets: Asset[];
  recovered?: boolean;
};
export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  status: Project["status"];
  durationMs: number;
  thumbnail?: string;
  path: string;
};
export type EditOperation =
  | ({ type: "cut" | "trim" } & Range)
  | ({ type: "speed"; speed: number } & Range)
  | { type: "split"; atMs: number }
  | { type: "clip.trim"; index: number; sourceStartMs: number; sourceEndMs: number }
  | { type: "clip.merge"; index: number }
  | ({ type: "source.restore" } & Range)
  | { type: "camera.update"; settings: Partial<Omit<CameraSettings, "hiddenRanges" | "layouts">> }
  | ({ type: "camera.hide"; hidden: boolean } & Range)
  | ({ type: "camera.layout.set"; settings: Partial<CameraLayoutSettings> } & Range)
  | ({ type: "camera.layout.remove" } & Range)
  | { type: "zoom.add"; zoom: Omit<Zoom, "id"> }
  | { type: "zoom.update"; id: string; zoom: Partial<Omit<Zoom, "id">> }
  | { type: "zoom.remove"; id: string }
  | { type: "overlay.add"; overlay: Omit<Overlay, "id"> }
  | { type: "overlay.update"; id: string; overlay: Partial<Omit<Overlay, "id">> }
  | { type: "overlay.remove"; id: string }
  | { type: "audio.update"; settings: Partial<EditState["audio"]> }
  | { type: "cursor.update"; settings: Partial<EditState["cursor"]> }
  | { type: "captions.update"; settings: Partial<EditState["captions"]> }
  | { type: "canvas.update"; settings: Partial<CanvasSettings> }
  | { type: "autoZoom.update"; settings: Partial<AutoZoomSettings> }
  | { type: "transcript.update"; segments: TranscriptSegment[] }
  | { type: "transcript.text"; id: string; text: string }
  | ({ type: "zooms.auto" } & Partial<AutoZoomSettings>);
export type Job = {
  id: string;
  projectId?: string;
  kind: "export" | "transcribe" | "silence" | "model" | "assistant";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  message: string;
  result?: unknown;
  error?: string;
  createdAt: string;
};
export type RecordingStatus = {
  active: boolean;
  paused: boolean;
  durationMs: number;
  projectId?: string;
  microphoneLevel: number;
  systemLevel: number;
  cameraVisible: boolean;
  cameraEnabled: boolean;
  cameraRunning?: boolean;
  phase?: "idle" | "starting" | "recording" | "paused" | "finalizing";
  monitoring?: {
    pointer: "active" | "inactive";
    input: "active" | "unavailable" | "failed" | "inactive";
    message?: string;
    pointerSamples: number;
    clicks: number;
    drags: number;
    typingEvents: number;
    firstPointerMs?: number;
  };
  error?: string;
};
export type AppCapabilities = {
  nativeAvailable: boolean;
  platform: string;
  recording: RecordingStatus;
  permissions: { screen: boolean; camera: string; microphone: string; input: boolean };
  sources: CaptureSource[];
  cameras: Device[];
  microphones: Device[];
};
export type RpcRequest = { id?: string; method: string; params?: Record<string, unknown> };
export type RpcError = { code: string; message: string; details?: unknown };
export type RpcResponse = { id?: string; result?: unknown; error?: RpcError };

export function defaultCanvas(): CanvasSettings {
  return {
    aspectRatio: "16:9",
    background: "gradient",
    color: "#111827",
    gradientTo: "#115e59",
    gradientAngle: 135,
    wallpaper: "aurora",
    blur: 0,
    padding: 0.06,
    radius: 0.025,
    shadow: 0.35,
    frame: "none",
    title: "",
  };
}
export function defaultAutoZoom(): AutoZoomSettings {
  return {
    enabled: true,
    scale: 1.7,
    leadMs: 400,
    holdMs: 1600,
    gapMs: 600,
    motion: "gentle",
    followCursor: true,
  };
}
export function defaultEdits(): EditState {
  return {
    segments: [],
    camera: {
      visible: true,
      shape: "circle",
      x: 0.76,
      y: 0.6,
      size: 0.2,
      shadow: true,
      hiddenRanges: [],
      layouts: [],
    },
    zooms: [],
    overlays: [],
    canvas: defaultCanvas(),
    autoZoom: defaultAutoZoom(),
    audio: { microphoneVolume: 1, systemVolume: 1 },
    cursor: { visible: true, highlight: true, smooth: true, size: 1 },
    captions: { enabled: false, fontSize: 42, color: "#ffffff", background: "#111318" },
  };
}
