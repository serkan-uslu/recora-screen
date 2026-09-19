import {
  ArrowDownToLine,
  AudioLines,
  Camera,
  Layers,
  MousePointer2,
  SlidersHorizontal,
  Sparkles,
  Subtitles,
} from "lucide-react";

export const tabItems = [
  { id: "export", icon: ArrowDownToLine, title: "Export" },
  { id: "general", icon: SlidersHorizontal, title: "Canvas" },
  { id: "camera", icon: Camera, title: "Camera" },
  { id: "zoom", icon: MousePointer2, title: "Zoom & cursor" },
  { id: "overlays", icon: Layers, title: "Layers" },
  { id: "audio", icon: AudioLines, title: "Audio" },
  { id: "transcript", icon: Subtitles, title: "Captions" },
  { id: "ai", icon: Sparkles, title: "AI assistant" },
] as const;
