import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useStableCallback } from "@/src/controllers/useStableCallback";

const minHeight = 360;
// Keep 200px for the editor above its 65px header and 26px status bar.
const viewportMaximum = () => Math.max(minHeight, window.innerHeight - 291);

export function useTimelineResize() {
  const [height, setHeight] = useState(minHeight);
  const [maxHeight, setMaxHeight] = useState(viewportMaximum);
  const drag = useRef<{
    pointerId: number;
    target: HTMLElement;
    y: number;
    height: number;
  } | null>(null);
  const clamp = useStableCallback((next: number) => Math.max(minHeight, Math.min(maxHeight, next)));
  const finish = useStableCallback((cancelled: boolean) => {
    const active = drag.current;
    if (!active) {
      return;
    }
    drag.current = null;
    if (cancelled) {
      setHeight(clamp(active.height));
    }
    if (active.target.hasPointerCapture(active.pointerId)) {
      active.target.releasePointerCapture(active.pointerId);
    }
  });
  const finishPointer = (event: ReactPointerEvent<HTMLElement>, cancelled = false) => {
    if (drag.current?.pointerId === event.pointerId) {
      event.stopPropagation();
      finish(cancelled);
    }
  };
  useEffect(() => {
    const resize = () => {
      const maximum = viewportMaximum();
      setMaxHeight(maximum);
      setHeight((current) => Math.min(maximum, current));
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault();
        event.stopPropagation();
        finish(true);
      }
    };
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown, true);
      const active = drag.current;
      drag.current = null;
      if (active?.target.hasPointerCapture(active.pointerId)) {
        active.target.releasePointerCapture(active.pointerId);
      }
    };
  }, [finish]);

  const style: CSSProperties & { "--timeline-height": string } = {
    "--timeline-height": `${height}px`,
  };
  const resizeProps: HTMLAttributes<HTMLDivElement> = {
    role: "separator",
    tabIndex: 0,
    "aria-label": "Resize timeline",
    "aria-orientation": "horizontal",
    "aria-valuemin": minHeight,
    "aria-valuemax": maxHeight,
    "aria-valuenow": height,
    "aria-valuetext": `${Math.round(height)} pixels`,
    onPointerDown: (event) => {
      if (event.button !== 0 || !event.isPrimary) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        pointerId: event.pointerId,
        target: event.currentTarget,
        y: event.clientY,
        height,
      };
    },
    onPointerMove: (event) => {
      const active = drag.current;
      if (active?.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        setHeight(clamp(active.height + active.y - event.clientY));
      }
    },
    onPointerUp: (event) => finishPointer(event),
    onPointerCancel: (event) => finishPointer(event, true),
    onLostPointerCapture: (event) => finishPointer(event, true),
    onKeyDown: (event) => {
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) || drag.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setHeight(
        event.key === "Home"
          ? minHeight
          : event.key === "End"
            ? maxHeight
            : clamp(height + (event.key === "ArrowUp" ? 20 : -20)),
      );
    },
  };
  return { height, minHeight, maxHeight, style, resizeProps };
}
