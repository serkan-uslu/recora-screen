import { useContext, useEffect, useRef, useState } from "react";
import {
  Camera,
  Layers,
  Maximize2,
  Mic,
  Monitor,
  MoreHorizontal,
  Scissors,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { defaultAutoZoom, type EditOperation, type Project, type Range } from "@/shared/types";
import { formatTime, sourceRanges } from "@/shared/timeline";
import { IconButton } from "@/src/components/atoms/IconButton";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { useStableCallback } from "@/src/controllers/useStableCallback";
import {
  clipSource,
  cameraSource,
  targetRange,
  targetPreviewTime,
  type EditorTarget,
} from "@/src/controllers/editorSelection";
import { number, seconds, formatTimecode } from "@/src/lib/format";
import { useTimelineGeometry } from "@/src/features/editor/hooks/useTimelineGeometry";
import { useTimelineDrag } from "@/src/features/editor/hooks/useTimelineDrag";
import { useTimelineResize } from "@/src/features/editor/hooks/useTimelineResize";
import { useTimelineSelection } from "@/src/features/editor/hooks/useTimelineSelection";
import { ScreenTrack } from "@/src/features/editor/tracks/ScreenTrack";
import { CameraTrack } from "@/src/features/editor/tracks/CameraTrack";
import { AudioTrack } from "@/src/features/editor/tracks/AudioTrack";
import { EffectsTrack } from "@/src/features/editor/tracks/EffectsTrack";
import { ClipContextMenu } from "@/src/features/editor/menus/ClipContextMenu";
import { TrackContextMenu } from "@/src/features/editor/menus/TrackContextMenu";
import type { TimelineMenu } from "@/src/features/editor/timelineTypes";

export function Timeline({
  project,
  total,
  timeMs,
  selection,
  setSelection,
  target,
  onSelectTarget,
  seek,
  apply,
  disabled,
  onEditZoom,
  onCameraLayout,
  beginScrub,
  endScrub,
  insertMedia,
}: {
  project: Project;
  total: number;
  timeMs: number;
  selection: Range;
  setSelection: (range: Range) => void;
  target: EditorTarget | null;
  onSelectTarget: (target: EditorTarget | null) => void;
  seek: (time: number) => Promise<void>;
  apply: (ops: EditOperation[], revision?: number) => Promise<void>;
  disabled: boolean;
  onEditZoom: (id: string) => void;
  onCameraLayout: () => void;
  beginScrub: () => void;
  endScrub: (time: number, cancelled?: boolean) => Promise<void>;
  insertMedia: (kind: "video" | "image") => Promise<void>;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const [zoom, setZoom] = useState(1);
  const { style, resizeProps } = useTimelineResize();
  const timeline = useRef<HTMLElement>(null);
  const activeTarget = target && targetRange(project, target) ? target : null;
  function selectTarget(item: EditorTarget) {
    onSelectTarget(item);
    timeline.current?.focus({ preventScroll: true });
  }
  function selectRange(range: Range) {
    setSelection(range);
  }
  function selectZoom(id: string) {
    selectTarget({ kind: "zoom", id });
    const time = targetPreviewTime(project, { kind: "zoom", id }, timeMs);
    if (time !== null) void seek(time);
  }
  function selectOverlay(id: string) {
    selectTarget({ kind: "overlay", id });
  }
  function selectClip(index: number) {
    const clip = intervals[index];
    if (!clip || disabled) return;
    selectTarget({ kind: "clip", index, source: clipSource(clip) });
    void seek(clip.outputStart);
  }

  const [menu, setMenu] = useState<TimelineMenu | null>(null);
  const tracks = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { ratio, intervals, gaps, selectedClip } = useTimelineGeometry(project, total, selection);
  const selected = selection.endMs > selection.startMs;
  const originalSelected =
    sourceRanges(project.edits.segments, selection.startMs, selection.endMs).length > 0;
  const { draft, startDrag, pointerEvents } = useTimelineDrag({
    project,
    total,
    intervals,
    disabled,
    tracks,
    suppressClick,
    draftPreview,
    apply,
    onSelectZoom: selectZoom,
  });
  const { timeAt, startRange, moveRange, finishRange } = useTimelineSelection({
    project,
    total,
    timeMs,
    selection,
    setSelection: selectRange,
    seek,
    disabled,
    beginScrub,
    endScrub,
    tracks,
    suppressClick,
    closeMenu: () => setMenu(null),
  });
  const canEditVideo = selected && (!activeTarget || activeTarget.kind === "clip");
  const canRemove =
    selected &&
    activeTarget?.kind !== "recordedAudio" &&
    (!canEditVideo || total - (selection.endMs - selection.startMs) >= 1);
  const selectionName =
    activeTarget?.kind === "clip"
      ? `Video clip ${activeTarget.index + 1}`
      : activeTarget?.kind === "camera"
        ? activeTarget.scope === "entire"
          ? "Camera · video default"
          : "Camera clip"
        : activeTarget?.kind === "zoom"
          ? "Zoom"
          : activeTarget?.kind === "overlay"
            ? "Layer"
            : activeTarget?.kind === "recordedAudio"
              ? "Recorded audio · video default mix"
              : activeTarget?.kind === "audio"
                ? "Audio clip"
                : "Time range · all video tracks";
  const deleteLabel =
    activeTarget?.kind === "camera"
      ? activeTarget.scope === "entire"
        ? "Hide camera track"
        : "Hide camera clip"
      : activeTarget?.kind === "recordedAudio"
        ? "Delete audio"
        : activeTarget
          ? `Delete ${activeTarget.kind === "clip" ? "video clip" : activeTarget.kind === "overlay" ? "layer" : activeTarget.kind === "audio" ? "audio clip" : "zoom"}`
          : "Delete time range";
  function removeSelection() {
    if (disabled || draft || !canRemove || (target && !activeTarget)) return false;
    let operation: EditOperation | undefined;
    if (activeTarget?.kind === "zoom") operation = { type: "zoom.remove", id: activeTarget.id };
    else if (activeTarget?.kind === "overlay")
      operation = { type: "overlay.remove", id: activeTarget.id };
    else if (activeTarget?.kind === "audio")
      operation = { type: "audioClip.remove", id: activeTarget.id };
    else if (activeTarget?.kind === "camera")
      operation =
        activeTarget.scope === "entire"
          ? { type: "camera.update", settings: { visible: false } }
          : { type: "camera.hide", ...activeTarget.range, hidden: true };
    else if (selected) operation = { type: "cut", ...selection };
    if (!operation) return false;
    if (activeTarget?.kind !== "camera") onSelectTarget(null);
    setMenu(null);
    void apply([operation], project.revision);
    return true;
  }
  const deleteSelection = useStableCallback((event: KeyboardEvent) => {
    if (
      !["Delete", "Backspace"].includes(event.key) ||
      event.defaultPrevented ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      document.querySelector("dialog[open]") ||
      (event.target instanceof HTMLElement &&
        event.target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
        ))
    )
      return;
    if (
      !activeTarget &&
      !(event.target instanceof Node && timeline.current?.contains(event.target))
    )
      return;
    if (removeSelection()) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", deleteSelection);
    return () => window.removeEventListener("keydown", deleteSelection);
  }, [deleteSelection]);
  useEffect(() => setMenu(null), [project.id, project.revision, disabled]);
  useEffect(() => {
    if (menu)
      menuRef.current
        ?.querySelector<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
        )
        ?.focus();
  }, [menu]);
  useEffect(() => {
    if (menu === null) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        timeline.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  const menuClip = menu?.kind === "clip" ? intervals[menu.index] : undefined;
  function menuPosition(clientX: number, clientY: number, wide = false) {
    const width = wide ? Math.min(590, window.innerWidth - 24) : 230;
    return {
      x: Math.max(12, Math.min(clientX, window.innerWidth - width - 12)),
      y: Math.max(12, Math.min(clientY, window.innerHeight - (wide ? 300 : 210))),
    };
  }
  function openClipMenu(
    index: number,
    clientX = window.innerWidth - 612,
    clientY = window.innerHeight - 250,
  ) {
    const clip = intervals[index];
    if (!clip || disabled) return;
    selectTarget({ kind: "clip", index, source: clipSource(clip) });
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
  return (
    <section
      className="timeline"
      style={style}
      ref={timeline}
      tabIndex={-1}
      aria-label="Timeline editor"
    >
      <div className="timeline-resize-handle" {...resizeProps} />
      <div className="timeline-toolbar">
        <div>
          <span className="timeline-title">Timeline</span>
          <span className="toolbar-divider" />
          <select
            className="restore-select"
            aria-label="Add media at playhead"
            value=""
            disabled={disabled || !project.source}
            onChange={(event) => {
              const kind = event.target.value;
              if (kind === "video" || kind === "image") void insertMedia(kind);
            }}
          >
            <option value="" disabled>
              Add media…
            </option>
            <option value="video">Insert video…</option>
            <option value="image">Insert image…</option>
          </select>
          <button
            className="button tiny"
            title="Split video at playhead (S)"
            disabled={disabled || timeMs <= 0 || timeMs >= total}
            onClick={() => void apply([{ type: "split", atMs: timeMs }])}
          >
            <Scissors size={16} /> Split video
          </button>
          <button
            className="button tiny"
            disabled={disabled || !canRemove}
            title={
              activeTarget?.kind === "camera"
                ? "Hide this camera interval; the video is unchanged"
                : "Remove the selected item (Delete / Backspace)"
            }
            onClick={() => removeSelection()}
          >
            <Trash2 size={15} /> {deleteLabel}
          </button>
          <button
            className="button tiny"
            disabled={disabled || !canEditVideo}
            title="Remove video before and after this time range"
            onClick={() => void apply([{ type: "trim", ...selection }])}
          >
            Keep only this range
          </button>
          <select
            className="timeline-speed"
            aria-label="Video speed for selected time range"
            disabled={disabled || !canEditVideo}
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
            disabled={disabled || activeTarget?.kind !== "clip"}
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
              aria-label="Restore deleted footage at playhead"
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
                      atMs: timeMs,
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
        <details className="timeline-range-options">
          <summary>Time range</summary>
          <div className="timeline-range">
            <label>
              Start (s)
              <input
                type="number"
                aria-label="Selection start in seconds"
                min={0}
                max={total / 1000}
                step={0.01}
                value={seconds(selection.startMs)}
                onChange={(e) => {
                  const startMs = Math.max(0, Math.min(total, number(e.target.value) * 1000));
                  selectRange({
                    startMs,
                    endMs: Math.max(startMs, selection.endMs),
                  });
                }}
              />
            </label>
            <label>
              End (s)
              <input
                type="number"
                aria-label="Selection end in seconds"
                min={selection.startMs / 1000}
                max={total / 1000}
                step={0.01}
                value={seconds(selection.endMs)}
                onChange={(e) =>
                  selectRange({
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
              onClick={() => {
                selectRange({ startMs: 0, endMs: total });
                timeline.current?.focus({ preventScroll: true });
              }}
            >
              <Maximize2 size={14} />
            </IconButton>
          </div>
        </details>
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
      <div className="selection-actions" aria-label="Selection actions">
        {selected ? (
          <>
            <span className="selection-context" role="status">
              {selectionName} · {formatTimecode(selection.startMs)}–
              {formatTimecode(selection.endMs)}
            </span>
            {activeTarget && (
              <button onClick={() => selectRange(selection)}>Select this time range</button>
            )}
            {activeTarget?.kind === "zoom" && (
              <button onClick={() => onEditZoom(activeTarget.id)}>Zoom settings…</button>
            )}
            {canEditVideo && (
              <button
                disabled={disabled || !originalSelected}
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
            )}
            {canEditVideo && (
              <button
                disabled={disabled || !project.source?.camera || !originalSelected}
                onClick={() => {
                  onCameraLayout();
                  void seek((selection.startMs + selection.endMs) / 2);
                }}
              >
                <Camera size={13} />
                Camera layout
              </button>
            )}
            <button
              onClick={() => selectRange({ startMs: 0, endMs: 0 })}
              aria-label="Clear selection"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <span>Click a clip to select · Shift-drag to select a range</span>
        )}
      </div>
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
            Video
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
            <ZoomIn size={13} />
            Zoom
          </span>
          <span onContextMenu={(event) => openTrackMenu(event, "effects")}>
            <Layers size={13} />
            Layers
          </span>
        </div>
        <div className="timeline-scroll">
          <div
            className="timeline-tracks"
            ref={tracks}
            tabIndex={-1}
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
                  ".clip, .trim-handle, .source-gap, .timeline-ruler, .playhead",
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
              aria-valuetext={formatTimecode(timeMs)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Home" || e.key === "End") {
                  e.preventDefault();
                  void seek(e.key === "Home" ? 0 : total);
                }
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
            <ScreenTrack
              projectId={project.id}
              intervals={intervals}
              gaps={gaps}
              draft={draft}
              selectedClip={activeTarget?.kind === "clip" ? activeTarget.index : -1}
              disabled={disabled}
              ratio={ratio}
              timeAt={timeAt}
              onSelectClip={selectClip}
              openClipMenu={openClipMenu}
              openTrackMenu={openTrackMenu}
              startDrag={startDrag}
              pointerEvents={pointerEvents}
              apply={(operations) => apply(operations)}
              hasSource={Boolean(project.source)}
            />
            <CameraTrack
              project={project}
              ratio={ratio}
              disabled={disabled}
              selected={
                activeTarget?.kind === "camera" && activeTarget.scope !== "entire"
                  ? activeTarget.range
                  : null
              }
              onSelect={(range) => {
                selectTarget({ kind: "camera", range, source: cameraSource(project) });
                void seek((range.startMs + range.endMs) / 2);
              }}
              onContextMenu={(event) => openTrackMenu(event, "camera")}
            />
            <AudioTrack
              selectedRange={activeTarget?.kind === "recordedAudio" ? activeTarget.range : null}
              onSelectRecorded={(range) =>
                selectTarget({ kind: "recordedAudio", range, source: cameraSource(project) })
              }
              selectedId={activeTarget?.kind === "audio" ? activeTarget.id : null}
              disabled={disabled}
              onSelect={(id, range) => {
                selectTarget({ kind: "audio", id });
                void seek(range.startMs);
              }}
              project={project}
              onContextMenu={(event) => openTrackMenu(event, "audio")}
            />
            <EffectsTrack
              project={project}
              draft={draft}
              selectedZoom={activeTarget?.kind === "zoom" ? activeTarget.id : null}
              selectedOverlay={activeTarget?.kind === "overlay" ? activeTarget.id : null}
              disabled={disabled}
              ratio={ratio}
              setSelection={setSelection}
              onSelectZoom={selectZoom}
              onEditZoom={onEditZoom}
              onSelectOverlay={selectOverlay}
              seek={seek}
              openTrackMenu={openTrackMenu}
              startDrag={startDrag}
              pointerEvents={pointerEvents}
            />
            {selected && !activeTarget && (
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
      {menuClip && menu?.kind === "clip" && (
        <ClipContextMenu
          menuRef={menuRef}
          position={menu}
          project={project}
          intervals={intervals}
          clip={menuClip}
          timeMs={timeMs}
          disabled={disabled}
          close={() => {
            setMenu(null);
            timeline.current?.focus({ preventScroll: true });
          }}
          apply={(operations) => void apply(operations)}
        />
      )}
      {menu && menu.kind !== "clip" && (
        <TrackContextMenu
          menuRef={menuRef}
          menu={menu}
          project={project}
          selection={selection}
          timeMs={timeMs}
          total={total}
          disabled={disabled}
          close={() => {
            setMenu(null);
            timeline.current?.focus({ preventScroll: true });
          }}
          apply={(operations) => void apply(operations)}
          seek={seek}
          onCameraLayout={onCameraLayout}
          onEditZoom={onEditZoom}
          onSelectOverlay={selectOverlay}
        />
      )}
    </section>
  );
}
