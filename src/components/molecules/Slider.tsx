import { useStableCallback } from "@/src/controllers/useStableCallback";
import { useContext, useEffect, useRef, useState } from "react";
import { ErrorContext, DraftPreviewContext } from "@/src/controllers/StudioContexts";

export function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  suffix = "%",
  onPreview,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
  onPreview?: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const draftValue = useRef(value);
  const lastCommit = useRef(value);
  const gesture = useRef<{ scope: string; cancelled: boolean } | null>(null);
  const pointer = useRef<{ target: HTMLInputElement; id: number } | null>(null);
  const { send: cancelPreview, scope } = useContext(DraftPreviewContext);
  const error = useContext(ErrorContext);
  function releasePointer() {
    const captured = pointer.current;
    pointer.current = null;
    if (captured?.target.hasPointerCapture(captured.id))
      captured.target.releasePointerCapture(captured.id);
  }
  const resetValue = useStableCallback(() => {
    setDraft(value);
    draftValue.current = value;
    lastCommit.current = value;
  });
  const cancelGesture = useStableCallback(() => {
    if (gesture.current) gesture.current.cancelled = true;
    releasePointer();
    resetValue();
    cancelPreview(null);
  });
  useEffect(() => {
    if (gesture.current && gesture.current.scope !== scope) cancelGesture();
    else resetValue();
  }, [scope, value, cancelGesture, resetValue]);
  useEffect(() => {
    if (error) cancelGesture();
  }, [error, cancelGesture]);
  useEffect(
    () => () => {
      if (gesture.current) cancelPreview(null);
      releasePointer();
    },
    [cancelPreview],
  );
  const commit = () => {
    const active = gesture.current;
    gesture.current = null;
    releasePointer();
    if (active && (active.cancelled || active.scope !== scope)) {
      resetValue();
      cancelPreview(null);
      return;
    }
    if (draftValue.current !== lastCommit.current) {
      lastCommit.current = draftValue.current;
      onChange(draftValue.current);
    } else if (active) cancelPreview(null);
  };
  return (
    <label className="slider-field">
      <span>
        {label}
        <b>
          {suffix === "%" ? Math.round(draft * 100) : draft.toFixed(1)}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={draft}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          releasePointer();
          gesture.current = { scope, cancelled: false };
          pointer.current = { target: e.currentTarget, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && gesture.current) {
            e.preventDefault();
            e.stopPropagation();
            cancelGesture();
            return;
          }
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
              "PageUp",
              "PageDown",
            ].includes(e.key) &&
            (!gesture.current || gesture.current.cancelled)
          )
            gesture.current = { scope, cancelled: false };
        }}
        onChange={(e) => {
          if (gesture.current && (gesture.current.cancelled || gesture.current.scope !== scope)) {
            resetValue();
            return;
          }
          gesture.current ??= { scope, cancelled: false };
          const next = Number(e.target.value);
          draftValue.current = next;
          setDraft(next);
          onPreview?.(next);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        onPointerCancel={cancelGesture}
      />
    </label>
  );
}
