import { useContext, useEffect, useRef, useState } from "react";
import {
  Camera,
  EyeOff,
  Layers,
  Maximize2,
  Mic,
  Monitor,
  MoreHorizontal,
  Scissors,
  X,
  ZoomIn,
} from "lucide-react";
import { defaultAutoZoom, type EditOperation, type Project, type Range } from "@/shared/types";
import { formatTime } from "@/shared/timeline";
import { IconButton } from "@/src/components/atoms/IconButton";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { number, seconds } from "@/src/lib/format";
import { useTimelineGeometry } from "@/src/features/editor/hooks/useTimelineGeometry";
import { useTimelineDrag } from "@/src/features/editor/hooks/useTimelineDrag";
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
  const tracks = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { ratio, intervals, gaps, selectedClip } = useTimelineGeometry(project, total, selection);
  const selected = selection.endMs > selection.startMs;
  const { draft, startDrag, pointerEvents } = useTimelineDrag({
    project,
    total,
    intervals,
    disabled,
    tracks,
    suppressClick,
    draftPreview,
    apply,
    onSelectZoom,
  });
  const { timeAt, startRange, moveRange, finishRange } = useTimelineSelection({
    project,
    total,
    timeMs,
    selection,
    setSelection,
    seek,
    disabled,
    beginScrub,
    endScrub,
    tracks,
    suppressClick,
    closeMenu: () => setMenu(null),
  });
  useEffect(() => setMenu(null), [project.id, project.revision, disabled]);
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
  const menuClip = menu?.kind === "clip" ? intervals[menu.index] : undefined;
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
            <ScreenTrack
              intervals={intervals}
              gaps={gaps}
              draft={draft}
              selectedClip={selectedClip}
              disabled={disabled}
              ratio={ratio}
              timeAt={timeAt}
              setSelection={setSelection}
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
              onContextMenu={(event) => openTrackMenu(event, "camera")}
            />
            <AudioTrack
              project={project}
              onContextMenu={(event) => openTrackMenu(event, "audio")}
            />
            <EffectsTrack
              project={project}
              draft={draft}
              selectedZoom={selectedZoom}
              disabled={disabled}
              ratio={ratio}
              setSelection={setSelection}
              onSelectZoom={onSelectZoom}
              onSelectOverlay={onSelectOverlay}
              seek={seek}
              openTrackMenu={openTrackMenu}
              startDrag={startDrag}
              pointerEvents={pointerEvents}
            />
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
      {menuClip && menu?.kind === "clip" && (
        <ClipContextMenu
          menuRef={menuRef}
          position={menu}
          project={project}
          intervals={intervals}
          clip={menuClip}
          timeMs={timeMs}
          disabled={disabled}
          close={() => setMenu(null)}
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
          close={() => setMenu(null)}
          apply={(operations) => void apply(operations)}
          seek={seek}
          onCameraLayout={onCameraLayout}
          onSelectZoom={onSelectZoom}
          onSelectOverlay={onSelectOverlay}
        />
      )}
    </section>
  );
}
