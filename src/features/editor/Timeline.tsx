import { useStableCallback } from "@/src/controllers/useStableCallback";
import { useContext, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Camera,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  Mic,
  Monitor,
  MoreHorizontal,
  Plus,
  Scissors,
  X,
  ZoomIn,
} from "lucide-react";
import { defaultAutoZoom, type EditOperation, type Project, type Range } from "@/shared/types";
import { formatTime, outputRanges, segmentDuration } from "@/shared/timeline";
import { IconButton } from "@/src/components/atoms/IconButton";
import { Field } from "@/src/components/molecules/Field";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { number, seconds } from "@/src/lib/format";

export function Timeline({
  project,
  total,
  timeMs,
  selection,
  setSelection,
  seek,
  apply,
  disabled,
  selectedZoom,
  onSelectZoom,
  onSelectOverlay,
  onCameraLayout,
  beginScrub,
  endScrub,
}: {
  project: Project;
  total: number;
  timeMs: number;
  selection: Range;
  setSelection: (range: Range) => void;
  seek: (time: number) => Promise<void>;
  apply: (ops: EditOperation[], revision?: number) => Promise<void>;
  disabled: boolean;
  selectedZoom: string | null;
  onSelectZoom: (id: string) => void;
  onSelectOverlay: (id: string) => void;
  onCameraLayout: () => void;
  beginScrub: () => void;
  endScrub: (time: number, cancelled?: boolean) => Promise<void>;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const [zoom, setZoom] = useState(1);
  const [menu, setMenu] = useState<TimelineMenu | null>(null);
  const [draft, setDraft] = useState<TimelineDrag | null>(null);
  const drag = useRef<TimelineDrag | null>(null);
  const dragPointer = useRef<{ target: HTMLElement; id: number } | null>(null);
  const tracks = useRef<HTMLDivElement>(null);
  const rangeDrag = useRef<{
    kind: "range" | "scrub";
    id: number;
    target: HTMLElement;
    origin: number;
    previousTime: number;
    previous: Range;
    revision: number;
    projectId: string;
  } | null>(null);
  const suppressClick = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ratio = (value: number) =>
    total ? `${Math.max(0, Math.min(100, (value / total) * 100))}%` : "0%";
  let offset = 0;
  const intervals = project.edits.segments.map((segment, index) => {
    const result = {
      ...segment,
      index,
      outputStart: offset,
      outputEnd: offset + segmentDuration(segment),
    };
    offset = result.outputEnd;
    return result;
  });
  const selected = selection.endMs > selection.startMs;
  const selectedClip = intervals.findIndex(
    (s) =>
      Math.abs(s.outputStart - selection.startMs) < 0.1 &&
      Math.abs(s.outputEnd - selection.endMs) < 0.1,
  );
  const gaps: (Range & { outputMs: number })[] = [];
  let lastSource = 0,
    outputMs = 0;
  for (const segment of intervals) {
    if (segment.startMs > lastSource)
      gaps.push({ startMs: lastSource, endMs: segment.startMs, outputMs });
    lastSource = segment.endMs;
    outputMs = segment.outputEnd;
  }
  if (project.source && lastSource < project.source.durationMs)
    gaps.push({
      startMs: lastSource,
      endMs: project.source.durationMs,
      outputMs: total,
    });
  const currentDrag = useStableCallback((value: TimelineDrag) => {
    return (
      !disabled &&
      value.projectId === project.id &&
      value.revision === project.revision &&
      (value.kind === "clip"
        ? Boolean(project.source) && Boolean(intervals[value.index])
        : project.edits.zooms.some((z) => z.id === value.id))
    );
  });
  const cancelDrag = useStableCallback(() => {
    drag.current = null;
    releaseDragPointer();
    setDraft(null);
    draftPreview(null);
  });
  const finishRange = useStableCallback(
    (e?: React.PointerEvent<HTMLElement>, cancelled = false) => {
      const active = rangeDrag.current;
      if (!active || (e && e.pointerId !== active.id)) return;
      e?.stopPropagation();
      rangeDrag.current = null;
      if (active.target.hasPointerCapture(active.id))
        active.target.releasePointerCapture(active.id);
      if (cancelled) setSelection(active.previous);
      void endScrub(cancelled ? active.previousTime : e ? timeAt(e.clientX) : timeMs, cancelled);
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    },
  );
  useEffect(() => {
    setMenu(null);
    if (drag.current && !currentDrag(drag.current)) cancelDrag();
  }, [project.id, project.revision, disabled, currentDrag, cancelDrag]);
  useEffect(
    () => () => {
      if (drag.current) draftPreview(null);
      releaseDragPointer();
    },
    [draftPreview],
  );
  useEffect(() => {
    if (menu === null) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  function timeAt(clientX: number) {
    const bounds = tracks.current!.getBoundingClientRect();
    return Math.max(0, Math.min(total, ((clientX - bounds.left) / bounds.width) * total));
  }
  function startRange(e: React.PointerEvent<HTMLElement>, kind: "range" | "scrub") {
    if (disabled || !total || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu(null);
    const origin = timeAt(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
    rangeDrag.current = {
      kind,
      id: e.pointerId,
      target: e.currentTarget,
      origin,
      previousTime: timeMs,
      previous: selection,
      revision: project.revision,
      projectId: project.id,
    };
    suppressClick.current = true;
    beginScrub();
    if (kind === "range") setSelection({ startMs: origin, endMs: origin });
    void seek(origin);
  }
  function moveRange(e: React.PointerEvent<HTMLElement>) {
    const active = rangeDrag.current;
    if (!active || active.id !== e.pointerId) return;
    e.stopPropagation();
    const time = timeAt(e.clientX);
    if (active.kind === "range")
      setSelection({
        startMs: Math.min(active.origin, time),
        endMs: Math.max(active.origin, time),
      });
    void seek(time);
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (!rangeDrag.current && !drag.current)) return;
      e.preventDefault();
      e.stopPropagation();
      if (rangeDrag.current) finishRange(undefined, true);
      if (drag.current) cancelDrag();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    if (
      rangeDrag.current &&
      (disabled ||
        rangeDrag.current.revision !== project.revision ||
        rangeDrag.current.projectId !== project.id)
    )
      finishRange(undefined, true);
  }, [disabled, project.id, project.revision, finishRange]);

  function releaseDragPointer() {
    const pointer = dragPointer.current;
    dragPointer.current = null;
    if (pointer?.target.hasPointerCapture(pointer.id))
      pointer.target.releasePointerCapture(pointer.id);
  }

  function startDrag(
    e: React.PointerEvent<HTMLElement>,
    kind: "zoom" | "clip",
    id: string,
    index: number,
    edge: TimelineDrag["edge"],
    range: Range,
  ) {
    if (disabled || !total || e.button !== 0 || e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    releaseDragPointer();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragPointer.current = { target: e.currentTarget, id: e.pointerId };
    const value: TimelineDrag = {
      projectId: project.id,
      revision: project.revision,
      kind,
      id,
      index,
      edge,
      originX: e.clientX,
      pixels: tracks.current?.getBoundingClientRect().width || 1,
      original: range,
      next: range,
    };
    drag.current = value;
    setDraft(value);
    if (kind === "zoom") onSelectZoom(id);
  }
  function moveDrag(e: React.PointerEvent<HTMLElement>) {
    const value = drag.current;
    if (!value || dragPointer.current?.id !== e.pointerId) return;
    e.stopPropagation();
    if (!currentDrag(value)) {
      cancelDrag();
      return;
    }
    suppressClick.current = true;
    const delta = ((e.clientX - value.originX) / value.pixels) * total;
    const original = value.original;
    let next: Range;
    if (value.kind === "clip") {
      const segment = intervals[value.index]!;
      const sourceDelta = delta * (segment.speed ?? 1);
      const minimum = intervals[value.index - 1]?.endMs ?? 0;
      const maximum = intervals[value.index + 1]?.startMs ?? project.source!.durationMs;
      next =
        value.edge === "start"
          ? {
              startMs: Math.max(
                minimum,
                Math.min(original.endMs - 1, original.startMs + sourceDelta),
              ),
              endMs: original.endMs,
            }
          : {
              startMs: original.startMs,
              endMs: Math.min(
                maximum,
                Math.max(original.startMs + 1, original.endMs + sourceDelta),
              ),
            };
    } else if (value.edge === "move") {
      const length = original.endMs - original.startMs;
      const startMs = Math.max(0, Math.min(total - length, original.startMs + delta));
      next = { startMs, endMs: startMs + length };
    } else
      next =
        value.edge === "start"
          ? {
              startMs: Math.max(0, Math.min(original.endMs - 1, original.startMs + delta)),
              endMs: original.endMs,
            }
          : {
              startMs: original.startMs,
              endMs: Math.min(total, Math.max(original.startMs + 1, original.endMs + delta)),
            };
    drag.current = { ...value, next };
    setDraft(drag.current);
    draftPreview(
      value.kind === "zoom"
        ? [{ type: "zoom.update", id: value.id, zoom: next }]
        : [
            {
              type: "clip.trim",
              index: value.index,
              sourceStartMs: next.startMs,
              sourceEndMs: next.endMs,
            },
          ],
    );
  }
  function finishDrag(e: React.PointerEvent<HTMLElement>) {
    const value = drag.current;
    if (!value || dragPointer.current?.id !== e.pointerId) return;
    e.stopPropagation();
    if (!currentDrag(value)) {
      cancelDrag();
      return;
    }
    releaseDragPointer();
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    drag.current = null;
    setDraft(null);
    if (
      Math.abs(value.original.startMs - value.next.startMs) +
        Math.abs(value.original.endMs - value.next.endMs) <
      0.01
    ) {
      draftPreview(null);
      return;
    }
    if (value.kind === "zoom")
      void apply([{ type: "zoom.update", id: value.id, zoom: value.next }], value.revision);
    else
      void apply(
        [
          {
            type: "clip.trim",
            index: value.index,
            sourceStartMs: value.next.startMs,
            sourceEndMs: value.next.endMs,
          },
        ],
        value.revision,
      );
  }
  const pointerEvents = {
    onPointerMove: moveDrag,
    onPointerUp: finishDrag,
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      cancelDrag();
    },
  };
  const menuClip = menu?.kind === "clip" ? intervals[menu.index] : undefined;
  const canMerge = (index: number) => {
    const before = intervals[index],
      after = intervals[index + 1];
    return (
      Boolean(before) &&
      Boolean(after) &&
      Math.abs(before.endMs - after.startMs) < 0.01 &&
      (before.speed ?? 1) === (after.speed ?? 1)
    );
  };
  function clipAction(operations: EditOperation[]) {
    setMenu(null);
    void apply(operations);
  }
  function menuPosition(clientX: number, clientY: number, wide = false) {
    const width = wide ? Math.min(590, window.innerWidth - 24) : 230;
    return {
      x: Math.max(12, Math.min(clientX, window.innerWidth - width - 12)),
      y: Math.max(12, Math.min(clientY, window.innerHeight - (wide ? 230 : 210))),
    };
  }
  function openClipMenu(
    index: number,
    clientX = window.innerWidth - 612,
    clientY = window.innerHeight - 250,
  ) {
    setMenu({ kind: "clip", index, ...menuPosition(clientX, clientY, true) });
  }
  function openTrackMenu(
    event: React.MouseEvent<HTMLElement>,
    kind: Exclude<TimelineMenu["kind"], "clip">,
    target?: { zoomId?: string; overlayId?: string },
  ) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ kind, ...target, ...menuPosition(event.clientX, event.clientY) });
  }
  function closeAnd(action: () => void) {
    setMenu(null);
    action();
  }
  return (
    <section className="timeline">
      <div className="timeline-toolbar">
        <div>
          <span className="timeline-title">Timeline</span>
          <span className="toolbar-divider" />
          <IconButton
            label="Split at playhead"
            disabled={disabled || timeMs <= 0 || timeMs >= total}
            onClick={() => void apply([{ type: "split", atMs: timeMs }])}
          >
            <Scissors size={16} />
          </IconButton>
          <button
            className="button tiny"
            disabled={disabled || !selected}
            onClick={() => void apply([{ type: "cut", ...selection }])}
          >
            Cut selection
          </button>
          <button
            className="button tiny"
            disabled={disabled || !selected}
            onClick={() => void apply([{ type: "trim", ...selection }])}
          >
            Keep selection
          </button>
          <select
            className="timeline-speed"
            aria-label="Playback speed for selection"
            disabled={disabled || !selected}
            value={selectedClip >= 0 ? String(intervals[selectedClip]!.speed ?? 1) : ""}
            onChange={(e) =>
              void apply([{ type: "speed", ...selection, speed: Number(e.target.value) }])
            }
          >
            <option value="" disabled>
              Speed
            </option>
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8].map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
          <IconButton
            label="Selected clip actions"
            disabled={disabled || selectedClip < 0}
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              openClipMenu(selectedClip, bounds.left, bounds.bottom + 6);
            }}
          >
            <MoreHorizontal size={16} />
          </IconButton>
          {gaps.length > 0 && (
            <select
              className="restore-select"
              aria-label="Restore deleted footage"
              defaultValue=""
              disabled={disabled}
              onChange={(e) => {
                const gap = gaps[Number(e.target.value)];
                if (gap)
                  void apply([
                    {
                      type: "source.restore",
                      startMs: gap.startMs,
                      endMs: gap.endMs,
                    },
                  ]);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Restore cut…
              </option>
              {gaps.map((gap, i) => (
                <option key={i} value={i}>
                  {seconds(gap.startMs)}–{seconds(gap.endMs)}s source
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="timeline-range">
          <label>
            IN
            <input
              type="number"
              aria-label="Selection start in seconds"
              min={0}
              max={total / 1000}
              step={0.01}
              value={seconds(selection.startMs)}
              onChange={(e) => {
                const startMs = Math.max(0, Math.min(total, number(e.target.value) * 1000));
                setSelection({
                  startMs,
                  endMs: Math.max(startMs, selection.endMs),
                });
              }}
            />
          </label>
          <label>
            OUT
            <input
              type="number"
              aria-label="Selection end in seconds"
              min={selection.startMs / 1000}
              max={total / 1000}
              step={0.01}
              value={seconds(selection.endMs)}
              onChange={(e) =>
                setSelection({
                  ...selection,
                  endMs: Math.max(
                    selection.startMs,
                    Math.min(total, number(e.target.value) * 1000),
                  ),
                })
              }
            />
          </label>
          <IconButton
            label="Select entire video"
            disabled={!total}
            onClick={() => setSelection({ startMs: 0, endMs: total })}
          >
            <Maximize2 size={14} />
          </IconButton>
        </div>
        <label className="timeline-zoom">
          <ZoomIn size={14} />
          <input
            aria-label="Timeline zoom"
            type="range"
            min={1}
            max={5}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
      </div>
      {selected && (
        <div className="selection-actions" aria-label="Selection actions">
          <span>
            Selected {seconds(selection.startMs)}–{seconds(selection.endMs)}s
          </span>
          <button
            disabled={disabled}
            onClick={() => {
              const settings = project.edits.autoZoom ?? defaultAutoZoom();
              void apply([
                {
                  type: "zoom.add",
                  zoom: {
                    ...selection,
                    scale: settings.scale,
                    x: 0.5,
                    y: 0.5,
                    motion: settings.motion,
                    followCursor: settings.followCursor,
                  },
                },
              ]);
            }}
          >
            <ZoomIn size={13} />
            Add zoom
          </button>
          <button
            disabled={disabled || !project.source?.camera}
            onClick={() => void apply([{ type: "camera.hide", ...selection, hidden: true }])}
          >
            <EyeOff size={13} />
            Hide camera
          </button>
          <button
            disabled={disabled || !project.source?.camera}
            onClick={() => void apply([{ type: "camera.hide", ...selection, hidden: false }])}
          >
            Show camera
          </button>
          <button
            disabled={disabled || !project.source?.camera}
            onClick={() => {
              onCameraLayout();
              void seek((selection.startMs + selection.endMs) / 2);
            }}
          >
            <Camera size={13} />
            Camera layout
          </button>
          <button
            onClick={() => setSelection({ startMs: 0, endMs: 0 })}
            aria-label="Clear selection"
          >
            <X size={13} />
          </button>
        </div>
      )}
      <div className="timeline-content">
        <div className="track-labels">
          <div />
          <span
            onContextMenu={(event) =>
              selectedClip >= 0
                ? (event.preventDefault(), openClipMenu(selectedClip, event.clientX, event.clientY))
                : openTrackMenu(event, "screen")
            }
          >
            <Monitor size={13} />
            Screen
          </span>
          <span onContextMenu={(event) => openTrackMenu(event, "camera")}>
            <Camera size={13} />
            Camera
          </span>
          <span onContextMenu={(event) => openTrackMenu(event, "audio")}>
            <Mic size={13} />
            Audio
          </span>
          <span onContextMenu={(event) => openTrackMenu(event, "effects")}>
            <Layers size={13} />
            Effects
          </span>
        </div>
        <div className="timeline-scroll">
          <div
            className="timeline-tracks"
            ref={tracks}
            onClickCapture={(e) => {
              if (suppressClick.current) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onPointerDownCapture={(e) => {
              if (e.shiftKey && !(e.target as HTMLElement).closest(".timeline-ruler, .playhead"))
                startRange(e, "range");
            }}
            onPointerDown={(e) => {
              if (
                !(e.target as HTMLElement).closest(
                  ".trim-handle, .zoom-clip, .overlay-clip, .source-gap, .timeline-ruler, .playhead",
                )
              )
                startRange(e, "range");
            }}
            onPointerMove={moveRange}
            onPointerUp={(e) => finishRange(e)}
            onPointerCancel={(e) => finishRange(e, true)}
            style={{ width: `${zoom * 100}%` }}
          >
            <div
              className="timeline-ruler"
              role="slider"
              aria-label="Timeline position"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={timeMs}
              tabIndex={0}
              onKeyDown={(e) => {
                if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                  e.preventDefault();
                  void seek(
                    timeMs +
                      (e.key === "ArrowLeft" ? -1 : 1) *
                        (e.shiftKey ? 1000 : 1000 / (project.source?.fps ?? 30)),
                  );
                }
              }}
              onPointerDown={(e) => startRange(e, "scrub")}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} style={{ left: `${i * 12.5}%` }}>
                  {formatTime((total / 8) * i)}
                </span>
              ))}
            </div>
            <div
              className="track screen-track"
              onContextMenu={(event) => {
                event.preventDefault();
                const at = timeAt(event.clientX);
                const clip = intervals.find(
                  (item) => at >= item.outputStart && at <= item.outputEnd,
                );
                if (clip) {
                  setSelection({ startMs: clip.outputStart, endMs: clip.outputEnd });
                  openClipMenu(clip.index, event.clientX, event.clientY);
                } else openTrackMenu(event, "screen");
              }}
            >
              {intervals.map((segment) => {
                const isDraft = draft?.kind === "clip" && draft.index === segment.index;
                const current = isDraft ? draft.next : segment;
                const start =
                  segment.outputStart + (current.startMs - segment.startMs) / (segment.speed ?? 1);
                const end =
                  segment.outputEnd + (current.endMs - segment.endMs) / (segment.speed ?? 1);
                return (
                  <div
                    key={`${segment.startMs}-${segment.endMs}-${segment.index}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Screen clip ${segment.index + 1}, ${segment.speed ?? 1} times speed`}
                    className={`clip screen-clip ${selectedClip === segment.index ? "selected" : ""}`}
                    style={{ left: ratio(start), width: ratio(end - start) }}

                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelection({
                          startMs: segment.outputStart,
                          endMs: segment.outputEnd,
                        });
                        openClipMenu(segment.index);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelection({
                        startMs: segment.outputStart,
                        endMs: segment.outputEnd,
                      });
                      openClipMenu(segment.index, e.clientX, e.clientY);
                    }}
                  >
                    <button
                      className="trim-handle start"
                      aria-label={`Trim start of clip ${segment.index + 1}`}
                      title="Drag to trim; use clip actions for exact times"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        openClipMenu(segment.index, e.clientX, e.clientY);
                      }}
                      onPointerDown={(e) =>
                        startDrag(e, "clip", "", segment.index, "start", segment)
                      }
                      {...pointerEvents}
                    />
                    <Monitor size={12} />
                    <span>Screen {intervals.length > 1 ? segment.index + 1 : ""}</span>
                    <b className="clip-speed">{segment.speed ?? 1}×</b>
                    <span className="clip-end">{formatTime(end - start)}</span>
                    <button
                      className="trim-handle end"
                      aria-label={`Trim end of clip ${segment.index + 1}`}
                      title="Drag to trim; use clip actions for exact times"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        openClipMenu(segment.index, e.clientX, e.clientY);
                      }}
                      onPointerDown={(e) => startDrag(e, "clip", "", segment.index, "end", segment)}
                      {...pointerEvents}
                    />
                  </div>
                );
              })}
              {gaps.map((gap, i) => (
                <button
                  key={`gap-${i}`}
                  className="source-gap"
                  style={{ left: ratio(gap.outputMs) }}
                  disabled={disabled}
                  aria-label={`Restore cut from source ${seconds(gap.startMs)} to ${seconds(gap.endMs)} seconds`}
                  title={`Restore ${seconds(gap.endMs - gap.startMs)}s of deleted footage`}
                  onClick={() =>
                    void apply([
                      {
                        type: "source.restore",
                        startMs: gap.startMs,
                        endMs: gap.endMs,
                      },
                    ])
                  }
                >
                  <Plus size={11} />
                </button>
              ))}
              {!project.source && (
                <span className="empty-track-label">Your recording will appear here</span>
              )}
            </div>
            <div className="track" onContextMenu={(event) => openTrackMenu(event, "camera")}>
              {project.source?.camera && (
                <>
                  <div
                    className="clip camera-clip"
                    style={{
                      width: "100%",
                      opacity: project.edits.camera.visible ? 1 : 0.25,
                    }}
                  >
                    <Camera size={12} />
                    <span>Camera</span>
                  </div>
                  {project.edits.camera.hiddenRanges
                    .flatMap((r) => outputRanges(project.edits.segments, r))
                    .map((r, i) => (
                      <div
                        key={i}
                        className="camera-hidden"
                        style={{
                          left: ratio(r.startMs),
                          width: ratio(r.endMs - r.startMs),
                        }}
                        title="Camera hidden"
                      >
                        <EyeOff size={12} />
                      </div>
                    ))}
                </>
              )}
            </div>
            <div className="track" onContextMenu={(event) => openTrackMenu(event, "audio")}>
              {(project.source?.microphone || project.source?.systemAudio) && (
                <div className="clip audio-clip" style={{ width: "100%" }}>
                  <AudioLines size={13} />
                  <span>
                    {[
                      project.source.microphone && "Microphone",
                      project.source.systemAudio && "System audio",
                    ]
                      .filter(Boolean)
                      .join(" + ")}
                  </span>
                  <span className="audio-track-line" />
                </div>
              )}
            </div>
            <div
              className="track effect-track"
              onContextMenu={(event) => openTrackMenu(event, "effects")}
            >
              {project.edits.zooms.map((z) => {
                const ranges = outputRanges(project.edits.segments, z);
                if (!ranges.length) return null;
                const actual = {
                  startMs: ranges[0]!.startMs,
                  endMs: ranges.at(-1)!.endMs,
                };
                const current = draft?.kind === "zoom" && draft.id === z.id ? draft.next : actual;
                return (
                  <div
                    key={z.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${z.scale} times zoom`}
                    className={`clip zoom-clip ${selectedZoom === z.id ? "selected" : ""}`}
                    style={{
                      left: ratio(current.startMs),
                      width: ratio(current.endMs - current.startMs),
                    }}
                    onClick={() => {
                      onSelectZoom(z.id);
                      setSelection(current);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectZoom(z.id);
                        setSelection(current);
                      }
                    }}
                    onContextMenu={(event) => {
                      onSelectZoom(z.id);
                      setSelection(current);
                      openTrackMenu(event, "effects", { zoomId: z.id });
                    }}
                    onPointerDown={(e) => startDrag(e, "zoom", z.id, -1, "move", actual)}
                    {...pointerEvents}
                  >
                    <button
                      className="trim-handle start"
                      tabIndex={-1}
                      aria-label="Resize zoom start"
                      disabled={disabled}
                      onPointerDown={(e) => startDrag(e, "zoom", z.id, -1, "start", actual)}
                      {...pointerEvents}
                    />
                    <ZoomIn size={11} />
                    <span>{z.scale}×</span>
                    <button
                      className="trim-handle end"
                      tabIndex={-1}
                      aria-label="Resize zoom end"
                      disabled={disabled}
                      onPointerDown={(e) => startDrag(e, "zoom", z.id, -1, "end", actual)}
                      {...pointerEvents}
                    />
                  </div>
                );
              })}
              {project.edits.overlays.flatMap((o) =>
                outputRanges(project.edits.segments, o).map((r, i) => (
                  <button
                    key={`${o.id}-${i}`}
                    className="clip overlay-clip"
                    style={{
                      left: ratio(r.startMs),
                      width: ratio(r.endMs - r.startMs),
                      top: 19,
                    }}
                    onClick={() => {
                      setSelection(r);
                      onSelectOverlay(o.id);
                      void seek((r.startMs + r.endMs) / 2);
                    }}
                    onContextMenu={(event) => {
                      setSelection(r);
                      onSelectOverlay(o.id);
                      openTrackMenu(event, "effects", { overlayId: o.id });
                    }}
                    title={o.text || "Image"}
                  >
                    <Layers size={10} />
                    <span>{o.text || "Image"}</span>
                  </button>
                )),
              )}
            </div>
            {selected && (
              <div
                className="timeline-selection"
                style={{
                  left: ratio(selection.startMs),
                  width: ratio(selection.endMs - selection.startMs),
                }}
              />
            )}
            {total > 0 && (
              <div
                className="playhead"
                aria-label="Drag playhead"
                onPointerDown={(e) => startRange(e, "scrub")}
                style={{ left: ratio(timeMs) }}
              >
                <span />
              </div>
            )}
            {draft && (
              <div className="drag-time-readout">
                {seconds(draft.next.startMs)} – {seconds(draft.next.endMs)}s{" "}
                {draft.kind === "clip" ? "source" : ""}
              </div>
            )}
          </div>
        </div>
      </div>
      {menuClip && (
        <div
          ref={menuRef}
          className="clip-context-menu"
          style={{ left: menu!.x, top: menu!.y }}
          role="dialog"
          aria-label={`Clip ${menuClip.index + 1} actions`}
        >
          <div className="clip-context-header">
            <strong>Clip {menuClip.index + 1}</strong>
            <IconButton label="Close clip actions" onClick={() => setMenu(null)}>
              <X size={12} />
            </IconButton>
          </div>
          <div className="clip-context-actions">
            <Field label="Playback speed">
              <select
                value={menuClip.speed ?? 1}
                disabled={disabled}
                onChange={(e) =>
                  clipAction([
                    {
                      type: "speed",
                      startMs: menuClip.outputStart,
                      endMs: menuClip.outputEnd,
                      speed: Number(e.target.value),
                    },
                  ])
                }
              >
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8].map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}×
                  </option>
                ))}
              </select>
            </Field>
            <button
              disabled={disabled || timeMs <= menuClip.outputStart || timeMs >= menuClip.outputEnd}
              onClick={() => clipAction([{ type: "split", atMs: timeMs }])}
            >
              Split here
            </button>
            <button
              disabled={disabled || intervals.length < 2}
              onClick={() =>
                clipAction([
                  {
                    type: "cut",
                    startMs: menuClip.outputStart,
                    endMs: menuClip.outputEnd,
                  },
                ])
              }
            >
              Delete clip
            </button>
            <button
              disabled={disabled || !canMerge(menuClip.index - 1)}
              onClick={() => clipAction([{ type: "clip.merge", index: menuClip.index - 1 }])}
            >
              Merge with previous
            </button>
            <button
              disabled={disabled || !canMerge(menuClip.index)}
              onClick={() => clipAction([{ type: "clip.merge", index: menuClip.index }])}
            >
              Merge with next
            </button>
          </div>
          <form
            key={`${project.revision}-${menuClip.index}`}
            className="clip-trim-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              clipAction([
                {
                  type: "clip.trim",
                  index: menuClip.index,
                  sourceStartMs: Number(data.get("sourceStart")) * 1000,
                  sourceEndMs: Number(data.get("sourceEnd")) * 1000,
                },
              ]);
            }}
          >
            <Field label="Source in (s)">
              <input
                aria-label="Clip source start in seconds"
                name="sourceStart"
                type="number"
                step={0.001}
                min={(intervals[menuClip.index - 1]?.endMs ?? 0) / 1000}
                max={(menuClip.endMs - 1) / 1000}
                defaultValue={menuClip.startMs / 1000}
              />
            </Field>
            <Field label="Source out (s)">
              <input
                aria-label="Clip source end in seconds"
                name="sourceEnd"
                type="number"
                step={0.001}
                min={(menuClip.startMs + 1) / 1000}
                max={(intervals[menuClip.index + 1]?.startMs ?? project.source!.durationMs) / 1000}
                defaultValue={menuClip.endMs / 1000}
              />
            </Field>
            <button className="button secondary" disabled={disabled}>
              Apply trim
            </button>
          </form>
        </div>
      )}
      {menu && menu.kind !== "clip" && (
        <div
          ref={menuRef}
          className="timeline-row-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          aria-label={`${menu.kind} track actions`}
        >
          <strong>{menu.kind[0]!.toUpperCase() + menu.kind.slice(1)} track</strong>
          {selected && (
            <small>
              {seconds(selection.startMs)}–{seconds(selection.endMs)}s selected
            </small>
          )}
          {menu.kind === "screen" && (
            <>
              <button
                disabled={disabled || timeMs <= 0 || timeMs >= total}
                onClick={() => closeAnd(() => void apply([{ type: "split", atMs: timeMs }]))}
              >
                Split at playhead
              </button>
              <button
                disabled={disabled || !selected}
                onClick={() => closeAnd(() => void apply([{ type: "cut", ...selection }]))}
              >
                Cut selection
              </button>
              <button
                disabled={disabled || !selected}
                onClick={() => closeAnd(() => void apply([{ type: "trim", ...selection }]))}
              >
                Keep selection
              </button>
            </>
          )}
          {menu.kind === "camera" && (
            <>
              <button
                disabled={disabled || !project.source?.camera}
                onClick={() =>
                  closeAnd(
                    () =>
                      void apply([
                        {
                          type: "camera.update",
                          settings: { visible: !project.edits.camera.visible },
                        },
                      ]),
                  )
                }
              >
                {project.edits.camera.visible ? <EyeOff size={13} /> : <Eye size={13} />}
                {project.edits.camera.visible ? "Hide camera" : "Show camera"}
              </button>
              <button
                disabled={disabled || !project.source?.camera || !selected}
                onClick={() =>
                  closeAnd(() => void apply([{ type: "camera.hide", ...selection, hidden: true }]))
                }
              >
                Hide in selection
              </button>
              <button
                disabled={disabled || !project.source?.camera || !selected}
                onClick={() =>
                  closeAnd(() => void apply([{ type: "camera.hide", ...selection, hidden: false }]))
                }
              >
                Show in selection
              </button>
              <button
                disabled={disabled || !project.source?.camera || !selected}
                onClick={() =>
                  closeAnd(() => {
                    onCameraLayout();
                    void seek((selection.startMs + selection.endMs) / 2);
                  })
                }
              >
                <Camera size={13} />
                Camera layout
              </button>
            </>
          )}
          {menu.kind === "audio" && (
            <>
              {project.source?.microphone && (
                <button
                  disabled={disabled}
                  onClick={() =>
                    closeAnd(
                      () =>
                        void apply([
                          {
                            type: "audio.update",
                            settings: {
                              microphoneVolume: project.edits.audio.microphoneVolume ? 0 : 1,
                            },
                          },
                        ]),
                    )
                  }
                >
                  {project.edits.audio.microphoneVolume ? "Mute microphone" : "Unmute microphone"}
                </button>
              )}
              {project.source?.systemAudio && (
                <button
                  disabled={disabled}
                  onClick={() =>
                    closeAnd(
                      () =>
                        void apply([
                          {
                            type: "audio.update",
                            settings: { systemVolume: project.edits.audio.systemVolume ? 0 : 1 },
                          },
                        ]),
                    )
                  }
                >
                  {project.edits.audio.systemVolume ? "Mute system audio" : "Unmute system audio"}
                </button>
              )}
              <button
                disabled={disabled || (!project.source?.microphone && !project.source?.systemAudio)}
                onClick={() =>
                  closeAnd(
                    () =>
                      void apply([
                        {
                          type: "audio.update",
                          settings: { microphoneVolume: 1, systemVolume: 1 },
                        },
                      ]),
                  )
                }
              >
                Reset levels
              </button>
            </>
          )}
          {menu.kind === "effects" && (
            <>
              {menu.zoomId && (
                <button onClick={() => closeAnd(() => onSelectZoom(menu.zoomId!))}>
                  <ZoomIn size={13} />
                  Edit zoom
                </button>
              )}
              {menu.zoomId && (
                <button
                  disabled={disabled}
                  className="danger"
                  onClick={() =>
                    closeAnd(() => void apply([{ type: "zoom.remove", id: menu.zoomId! }]))
                  }
                >
                  Remove zoom
                </button>
              )}
              {menu.overlayId && (
                <button onClick={() => closeAnd(() => onSelectOverlay(menu.overlayId!))}>
                  <Layers size={13} />
                  Edit layer
                </button>
              )}
              {menu.overlayId && (
                <button
                  disabled={disabled}
                  className="danger"
                  onClick={() =>
                    closeAnd(() => void apply([{ type: "overlay.remove", id: menu.overlayId! }]))
                  }
                >
                  Remove layer
                </button>
              )}
              <button
                disabled={disabled || !selected}
                onClick={() =>
                  closeAnd(() => {
                    const settings = project.edits.autoZoom ?? defaultAutoZoom();
                    void apply([
                      {
                        type: "zoom.add",
                        zoom: {
                          ...selection,
                          scale: settings.scale,
                          x: 0.5,
                          y: 0.5,
                          motion: settings.motion,
                          followCursor: settings.followCursor,
                        },
                      },
                    ]);
                  })
                }
              >
                <ZoomIn size={13} />
                Add zoom to selection
              </button>
              <button
                disabled={disabled || !project.source}
                onClick={() => closeAnd(() => void apply([{ type: "zooms.auto" }]))}
              >
                Redetect automatic zooms
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
type TimelineMenu =
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
  kind: "zoom" | "clip";
  id: string;
  index: number;
  edge: "start" | "end" | "move";
  originX: number;
  pixels: number;
  original: Range;
  next: Range;
};
