import {
  AudioLines,
  Camera,
  Layers,
  MousePointer2,
  SlidersHorizontal,
  Sparkles,
  Subtitles,
} from "lucide-react";

export const tabItems = [
  { id: "general", icon: SlidersHorizontal, title: "General" },
  { id: "camera", icon: Camera, title: "Camera" },
  { id: "zoom", icon: MousePointer2, title: "Zoom & cursor" },
  { id: "overlays", icon: Layers, title: "Overlays" },
  { id: "audio", icon: AudioLines, title: "Audio" },
  { id: "transcript", icon: Subtitles, title: "Transcript" },
  { id: "ai", icon: Sparkles, title: "AI assistant" },
] as const;
