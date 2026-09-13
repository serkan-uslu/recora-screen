export type Range = { startMs: number; endMs: number };
export type CaptureSource = { id: string; name: string; kind: 'display' | 'window'; width: number; height: number };
export type Device = { id: string; name: string };
export type CaptureSettings = {
  sourceId: string; sourceKind: 'display' | 'window';
  region?: { x: number; y: number; width: number; height: number };
  cameraId?: string; microphoneId?: string; systemAudio: boolean;
  cameraShape: 'circle' | 'square'; width: number; height: number; fps: 30;
};
export type RecordingSource = {
  durationMs: number; width: number; height: number; fps: number;
  screen: string; camera?: string; microphone?: string; systemAudio?: string; cursor?: string;
  cameraActiveRanges?: Range[];
};
export type CursorEvent = { tMs: number; x: number; y: number; click?: boolean };
export type CameraSettings = {
  visible: boolean; shape: 'circle' | 'square'; x: number; y: number; size: number;
  shadow: boolean; hiddenRanges: Range[];
};
export type Zoom = Range & { id: string; scale: number; x: number; y: number };
export type Overlay = Range & {
  id: string; kind: 'text' | 'image'; text?: string; assetId?: string;
  x: number; y: number; width: number; fontSize: number; color: string;
  animation: 'none' | 'fade' | 'slide';
};
export type TranscriptSegment = Range & { id: string; text: string };
export type Asset = { id: string; name: string; path: string; kind: 'image' };
export type EditState = {
  segments: Range[]; camera: CameraSettings; zooms: Zoom[]; overlays: Overlay[];
  audio: { microphoneVolume: number; systemVolume: number };
  cursor: { visible: boolean; highlight: boolean; smooth: boolean; size: number };
  captions: { enabled: boolean; fontSize: number; color: string; background: string };
};
export type Project = {
  schemaVersion: 1; id: string; name: string; createdAt: string; updatedAt: string;
  revision: number; status: 'draft' | 'recording' | 'ready';
  source?: RecordingSource; edits: EditState; transcript: TranscriptSegment[]; assets: Asset[];
  recovered?: boolean;
};
export type ProjectSummary = {
  id: string; name: string; createdAt: string; updatedAt: string; revision: number;
  status: Project['status']; durationMs: number; thumbnail?: string; path: string;
};
export type EditOperation =
  | ({ type: 'cut' | 'trim' } & Range)
  | { type: 'split'; atMs: number }
  | { type: 'camera.update'; settings: Partial<Omit<CameraSettings, 'hiddenRanges'>> }
  | ({ type: 'camera.hide'; hidden: boolean } & Range)
  | { type: 'zoom.add'; zoom: Omit<Zoom, 'id'> }
  | { type: 'zoom.remove'; id: string }
  | { type: 'overlay.add'; overlay: Omit<Overlay, 'id'> }
  | { type: 'overlay.update'; id: string; overlay: Partial<Omit<Overlay, 'id'>> }
  | { type: 'overlay.remove'; id: string }
  | { type: 'audio.update'; settings: Partial<EditState['audio']> }
  | { type: 'cursor.update'; settings: Partial<EditState['cursor']> }
  | { type: 'captions.update'; settings: Partial<EditState['captions']> }
  | { type: 'transcript.update'; segments: TranscriptSegment[] }
  | { type: 'zooms.auto'; scale?: number };
export type Job = {
  id: string; projectId?: string; kind: 'export' | 'transcribe' | 'silence' | 'model' | 'assistant';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; message: string; result?: unknown; error?: string;
  createdAt: string;
};
export type RecordingStatus = {
  active: boolean; paused: boolean; durationMs: number; projectId?: string;
  microphoneLevel: number; systemLevel: number; cameraVisible: boolean; cameraEnabled: boolean;
  cameraRunning?: boolean;
  error?: string;
};
export type AppCapabilities = {
  nativeAvailable: boolean; platform: string; recording: RecordingStatus;
  permissions: { screen: boolean; camera: string; microphone: string; input: boolean };
  sources: CaptureSource[]; cameras: Device[]; microphones: Device[];
};
export type RpcRequest = { id?: string; method: string; params?: Record<string, unknown> };
export type RpcError = { code: string; message: string; details?: unknown };
export type RpcResponse = { id?: string; result?: unknown; error?: RpcError };

export function defaultEdits(): EditState {
  return {
    segments: [],
    camera: { visible: true, shape: 'circle', x: 0.76, y: 0.60, size: 0.2, shadow: true, hiddenRanges: [] },
    zooms: [], overlays: [], audio: { microphoneVolume: 1, systemVolume: 1 },
    cursor: { visible: true, highlight: true, smooth: true, size: 1 },
    captions: { enabled: false, fontSize: 42, color: '#ffffff', background: '#111318' },
  };
}
