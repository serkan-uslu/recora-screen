import { useContext, useEffect, useRef } from "react";
import type { EditOperation, Project, Range } from "@/shared/types";
import { cameraAt } from "@/shared/camera";
import { command, desktop, messageOf } from "@/src/api";
import { useStableCallback } from "@/src/controllers/useStableCallback";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { cameraEdit } from "@/src/controllers/cameraEdit";
import type {
  PreviewGeometry,
  PreviewItem,
  PreviewPlayback,
} from "@/src/controllers/previewPlayback";

type PreviewSelection = { kind: "camera" | "overlay"; id?: string } | null;
export type PreviewEditingProps = {
  project: Project;
  playback: PreviewPlayback;
  selection: Range;
  cameraScope: "selection" | "entire";
  selected: PreviewSelection;
  onSelect: (
    item: PreviewSelection,
  ) => { selection: Range; cameraScope: "selection" | "entire" } | void;
  apply: (operations: EditOperation[], revision?: number) => Promise<void>;
  disabled: boolean;
  onError: (error: string) => void;
};
type Gesture = {
  target: HTMLElement;
  pointer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  revision: number;
  projectId: string;
  time: number;
  item: PreviewItem;
  corner: string | null;
  text?: { fontSize: number; canvasWidth: number; canvasHeight: number };
  operation: EditOperation | null;
  project: Project;
  selection: Range;
  cameraScope: "selection" | "entire";
};
const accent = () =>
  getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function previewTransform(
  gesture: Pick<Gesture, "item" | "corner" | "width" | "height" | "text">,
  dx: number,
  dy: number,
) {
  const { item, corner, width, height, text: textLayout } = gesture;
  const text =
    textLayout &&
    textLayout.canvasWidth > 24 &&
    textLayout.canvasHeight > 26 &&
    item.width > 24 / textLayout.canvasWidth &&
    item.height > 26 / textLayout.canvasHeight
      ? textLayout
      : undefined;
  if (!corner)
    return {
      x: clamp(item.x + dx / width, 0, Math.max(0, 1 - item.width)),
      y: clamp(item.y + dy / height, 0, Math.max(0, 1 - item.height)),
      width: item.width,
      height: item.height,
      scale: 1,
    };
  const left = corner.includes("w"),
    top = corner.includes("n");
  // Core Text adds fixed 24px horizontal / 26px vertical padding. Scale the glyph area,
  // so changing the font and wrapping width together leaves the opposite corner anchored.
  const paddingX = text ? 24 / text.canvasWidth : 0,
    paddingY = text ? 26 / text.canvasHeight : 0;
  const contentWidth = Math.max(Number.EPSILON, item.width - paddingX),
    contentHeight = Math.max(Number.EPSILON, item.height - paddingY);
  const w = contentWidth * width,
    h = contentHeight * height;
  const ratio = 1 + ((left ? -dx : dx) * w + (top ? -dy : dy) * h) / (w * w + h * h);
  const maxWidth = item.kind === "camera" ? Math.min(0.5, height / width) : 1;
  const minWidth = item.kind === "camera" ? 0.08 : 0.05;
  const scale = text
    ? clamp(
        ratio,
        Math.max(12 / text.fontSize, (minWidth - paddingX) / contentWidth),
        Math.min(200 / text.fontSize, (maxWidth - paddingX) / contentWidth),
      )
    : clamp(item.width * ratio, minWidth, maxWidth) / item.width;
  const nextWidth = contentWidth * scale + paddingX;
  const nextHeight = text
    ? (Math.ceil((Math.round(item.height * text.canvasHeight) - 26) * scale - 1e-7) + 26) /
      text.canvasHeight
    : item.height * scale;
  return {
    x: clamp(left ? item.x + item.width - nextWidth : item.x, 0, Math.max(0, 1 - nextWidth)),
    y: clamp(top ? item.y + item.height - nextHeight : item.y, 0, Math.max(0, 1 - nextHeight)),
    width: nextWidth,
    height: nextHeight,
    scale,
  };
}

/** Replay the pointer's final position when geometry arrives after pointer-up. */
export function replayPreviewGesture(
  start: { x: number; y: number },
  point: { x: number; y: number },
  released: boolean,
  handlers: {
    start: () => void;
    move: (x: number, y: number) => void;
    finish: () => void;
  },
) {
  if (released && Math.abs(point.x - start.x) + Math.abs(point.y - start.y) < 1) return;
  handlers.start();
  handlers.move(point.x, point.y);
  if (released) handlers.finish();
}

export function usePreviewEditingController(props: PreviewEditingProps) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const latest = useRef(props);
  latest.current = props;
  const gesture = useRef<Gesture | null>(null);
  const pending = useRef<{
    id: number;
    target: HTMLElement;
    released: boolean;
    point?: { x: number; y: number };
  } | null>(null);
  const geometry = useRef<PreviewGeometry | undefined>(undefined);
  const geometryTime = useRef(-1);
  const pointerPosition = useRef({ x: 0, y: 0 });
  const updateGeometry = useStableCallback(() => {
    const snapshot = props.playback.getSnapshot();
    if (geometry.current !== snapshot.geometry) {
      geometry.current = snapshot.geometry;
      geometryTime.current = snapshot.timeMs;
    }
  });
  useEffect(() => {
    updateGeometry();
    return props.playback.subscribe(updateGeometry);
  }, [props.playback, updateGeometry]);
  useEffect(() => {
    geometry.current = undefined;
    geometryTime.current = -1;
  }, [props.project.id, props.project.revision]);
  useEffect(() => {
    if (desktop)
      void command("preview.selection", { selection: props.selected, color: accent() }).catch(
        () => {},
      );
  }, [props.project.id, props.selected]);
  function release() {
    const capture =
      pending.current ??
      (gesture.current ? { target: gesture.current.target, id: gesture.current.pointer } : null);
    pending.current = null;
    if (capture?.target.hasPointerCapture(capture.id))
      capture.target.releasePointerCapture(capture.id);
  }
  const finish = useStableCallback((cancelled = false) => {
    const active = gesture.current;
    if (!active && pending.current && !cancelled) {
      pending.current.released = true;
      pending.current.point = { ...pointerPosition.current };
      if (pending.current.target.hasPointerCapture(pending.current.id))
        pending.current.target.releasePointerCapture(pending.current.id);
      return;
    }
    release();
    gesture.current = null;
    if (!active) return;
    const current = latest.current;
    const stale =
      active.projectId !== current.project.id || active.revision !== current.project.revision;
    if (cancelled || stale || !active.operation) draftPreview(null);
    else void current.apply([active.operation], active.revision);
    if (active.projectId === current.project.id) void current.playback.endScrub(active.time);
  });
  useEffect(() => {
    if (
      gesture.current &&
      (props.disabled ||
        gesture.current.projectId !== props.project.id ||
        gesture.current.revision !== props.project.revision)
    )
      finish(true);
  }, [props.disabled, props.project.id, props.project.revision, finish]);
  useEffect(
    () => () => {
      if (gesture.current) draftPreview(null);
      release();
    },
    [draftPreview],
  );
  function move(clientX: number, clientY: number) {
    const active = gesture.current;
    if (!active) return;
    const transform = previewTransform(active, clientX - active.x, clientY - active.y);
    if (!active.operation && Math.abs(clientX - active.x) + Math.abs(clientY - active.y) < 1)
      return;
    if (active.item.kind === "camera") {
      const camera = cameraAt(active.project, active.time);
      active.operation = cameraEdit(active.selection, active.cameraScope, {
        ...camera,
        x: clamp(camera.x + transform.x - active.item.x, 0, 1),
        y: clamp(camera.y + transform.y - active.item.y, 0, 1),
        size: clamp((camera.size * transform.width) / active.item.width, 0.05, 0.8),
      });
    } else {
      const overlay = active.project.edits.overlays.find((item) => item.id === active.item.id)!;
      // Apply the visual delta to stored coordinates so slide-in animation is not baked into the layout.
      active.operation = {
        type: "overlay.update",
        id: overlay.id,
        overlay: {
          x: clamp(overlay.x + transform.x - active.item.x, 0, 1),
          y: clamp(overlay.y + transform.y - active.item.y, 0, 1),
          ...(active.corner
            ? {
                width: transform.width,
                ...(overlay.kind === "text"
                  ? { fontSize: clamp(overlay.fontSize * transform.scale, 12, 200) }
                  : ["arrow", "blur", "redact"].includes(overlay.kind)
                    ? { height: clamp(transform.height, 0.02, 1) }
                    : {}),
              }
            : {}),
        },
      };
    }
    draftPreview([active.operation]);
  }
  return {
    tabIndex: 0,
    role: "group",
    "aria-label": "Video canvas. Drag camera or layers to move; drag corners to resize.",
    onPointerDown: async (event: React.PointerEvent<HTMLDivElement>) => {
      if (!desktop || props.disabled || event.button !== 0) return;
      if (gesture.current || pending.current) finish(true);
      const target = event.currentTarget,
        pointer = event.pointerId,
        x = event.clientX,
        y = event.clientY;
      event.preventDefault();
      target.focus();
      target.setPointerCapture(pointer);
      const request: NonNullable<typeof pending.current> = { id: pointer, target, released: false };
      pending.current = request;
      pointerPosition.current = { x, y };
      const initialProject = props.project;
      try {
        const current = latest.current;
        let time = current.playback.getSnapshot().timeMs;
        const frame =
          geometry.current && Math.abs(geometryTime.current - time) < 34
            ? geometry.current
            : await command<PreviewGeometry>("preview.geometry", { timeMs: time });
        if (
          pending.current !== request ||
          latest.current.disabled ||
          latest.current.project.id !== initialProject.id ||
          latest.current.project.revision !== initialProject.revision
        ) {
          if (pending.current === request) release();
          return;
        }
        geometry.current = frame;
        const bounds = target.getBoundingClientRect(),
          px = (x - bounds.left) / bounds.width,
          py = (y - bounds.top) / bounds.height;
        let corner: string | null = null;
        const selected = frame.items.find(
          (item) =>
            item.kind === current.selected?.kind &&
            (item.kind === "camera" || item.id === current.selected?.id),
        );
        if (selected) {
          for (const [name, cx, cy] of [
            ["nw", selected.x, selected.y],
            ["ne", selected.x + selected.width, selected.y],
            ["sw", selected.x, selected.y + selected.height],
            ["se", selected.x + selected.width, selected.y + selected.height],
          ] as const)
            if (Math.abs(px - cx) * bounds.width <= 12 && Math.abs(py - cy) * bounds.height <= 12)
              corner = name;
        }
        const item = corner
          ? selected
          : [...frame.items]
              .reverse()
              .find(
                (item) =>
                  px >= item.x &&
                  px <= item.x + item.width &&
                  py >= item.y &&
                  py <= item.y + item.height,
              );
        if (!item) {
          current.onSelect(null);
          release();
          return;
        }
        const selectedItem =
          item.kind === "camera"
            ? { kind: "camera" as const }
            : { kind: "overlay" as const, id: item.id };
        const selectedContext = current.onSelect(selectedItem);
        const selection = selectedContext?.selection ?? current.selection;
        const cameraScope = selectedContext?.cameraScope ?? current.cameraScope;
        void command("preview.selection", { selection: selectedItem, color: accent() }).catch(
          () => {},
        );
        // Hit-test the visible frame before moving to the range being edited, even when
        // Camera was not the active inspector tab at pointer-down.
        if (
          item.kind === "camera" &&
          cameraScope === "selection" &&
          selection.endMs > selection.startMs
        )
          time = (selection.startMs + selection.endMs) / 2;
        const overlay =
          item.kind === "overlay"
            ? initialProject.edits.overlays.find((entry) => entry.id === item.id)
            : undefined;
        const finalPoint = request.point ?? pointerPosition.current;
        pending.current = null;
        replayPreviewGesture({ x, y }, finalPoint, request.released, {
          start: () => {
            current.playback.beginScrub();
            gesture.current = {
              target,
              pointer,
              x,
              y,
              width: bounds.width,
              height: bounds.height,
              revision: initialProject.revision,
              projectId: initialProject.id,
              project: initialProject,
              item,
              corner,
              operation: null,
              time,
              selection,
              cameraScope,
              ...(overlay?.kind === "text"
                ? {
                    text: {
                      fontSize: overlay.fontSize,
                      canvasWidth: frame.width,
                      canvasHeight: frame.height,
                    },
                  }
                : {}),
            };
            if (time !== current.playback.getSnapshot().timeMs) void current.playback.seek(time);
          },
          move,
          finish,
        });
      } catch (error) {
        if (pending.current === request) {
          release();
          latest.current.onError(messageOf(error));
        }
      }
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (pending.current?.released) return;
      pointerPosition.current = { x: event.clientX, y: event.clientY };
      if (gesture.current) {
        event.preventDefault();
        move(event.clientX, event.clientY);
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      pointerPosition.current = { x: event.clientX, y: event.clientY };
      if (gesture.current) move(event.clientX, event.clientY);
      finish();
    },
    onPointerCancel: () => finish(true),
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (gesture.current || pending.current) finish(true);
        else props.onSelect(null);
      }
    },
  };
}
