import type { PointerEventHandler } from "react";
import type { Range } from "@/shared/types";

export type TimelineMenu =
  | { kind: "clip"; index: number; x: number; y: number }
  | {
      kind: "screen" | "camera" | "audio" | "effects";
      x: number;
      y: number;
      zoomId?: string;
      overlayId?: string;
    };

export type TimelineDrag = {
  projectId: string;
  revision: number;
  kind: "zoom" | "overlay" | "clip";
  id: string;
  index: number;
  edge: "start" | "end" | "move";
  originX: number;
  pixels: number;
  original: Range;
  next: Range;
};

export type TimelinePointerEvents = {
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
};
