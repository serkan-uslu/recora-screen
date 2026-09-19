import { useSyncExternalStore, useContext, useRef } from "react";
import { DraftPreviewContext } from "@/src/controllers/StudioContexts";
import {
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Clapperboard,
  Mic,
  Pause,
  Play,
  Scissors,
  SkipBack,
  SkipForward,
  Video,
} from "lucide-react";
import { formatTime, duration, segmentDuration } from "@/shared/timeline";
import { IconButton } from "@/src/components/atoms/IconButton";
import { Slider } from "@/src/components/molecules/Slider";
import { PanelIntro } from "@/src/components/molecules/PanelIntro";
import { NativePreview } from "@/src/features/editor/NativePreview";
import { CanvasPanel } from "@/src/features/editor/panels/CanvasPanel";
import { CameraPanel } from "@/src/features/editor/panels/CameraPanel";
import { ZoomPanel } from "@/src/features/editor/panels/ZoomPanel";
import { ZoomSettingsDialog } from "@/src/features/editor/panels/ZoomSettingsDialog";
import { OverlaysPanel } from "@/src/features/editor/panels/OverlaysPanel";
import { AudioClipsPanel } from "@/src/features/audio/AudioClipsPanel";
import { SilenceControls } from "@/src/features/audio/SilenceControls";
import { TranscriptPanel } from "@/src/features/transcript/TranscriptPanel";
import { AssistantPanel } from "@/src/features/assistant/AssistantPanel";
import { Timeline } from "@/src/features/editor/Timeline";
import { tabItems } from "@/src/features/editor/tabs";
import {
  cameraSource,
  targetPreviewTime,
  previewCameraRange,
} from "@/src/controllers/editorSelection";
import { useTimelineGeometry } from "@/src/features/editor/hooks/useTimelineGeometry";
import { ClipContextMenu } from "@/src/features/editor/menus/ClipContextMenu";
import { EditorQuickStart } from "@/src/features/help/EditorQuickStart";
import { seconds, formatTimecode } from "@/src/lib/format";
import { type StudioController } from "@/src/controllers/useStudioController";
import { ExportPanel } from "@/src/features/export/ExportDialog";
import { useProjectSaveState } from "@/src/controllers/useProjectController";

export function EditorScreen({
  studio,
}: {
  studio: Pick<
    StudioController,
    | "exportTranscript"
    | "project"
    | "recording"
    | "modal"
    | "setModal"
    | "tab"
    | "setTab"
    | "selectedZoom"
    | "inspectorRef"
    | "setError"
    | "busy"
    | "playback"
    | "cameraScope"
    | "setCameraScope"
    | "selection"
    | "setSelection"
    | "editorTarget"
    | "selectEditorTarget"
    | "importVideo"
    | "settings"
    | "chats"
    | "setChats"
    | "silenceReview"
    | "setSilenceReview"
    | "total"
    | "importImage"
    | "importAudio"
    | "insertMedia"
    | "apply"
    | "backToLibrary"
    | "seek"
    | "togglePlayback"
    | "startJob"
    | "projectBusy"
    | "exportVideo"
  >;
}) {
  const {
    exportTranscript,
    project,
    recording,
    modal,
    setModal,
    tab,
    setTab,
    selectedZoom,
    inspectorRef,
    setError,
    busy,
    playback,
    cameraScope,
    setCameraScope,
    selection,
    setSelection,
    editorTarget,
    selectEditorTarget,
    importVideo,
    settings,
    chats,
    setChats,
    silenceReview,
    setSilenceReview,
    total,
    importImage,
    importAudio,
    insertMedia,
    apply,
    backToLibrary,
    seek,
    startJob,
    projectBusy,
    exportVideo,
  } = studio;
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const clipPanelRef = useRef<HTMLDivElement>(null);
  const saveState = useProjectSaveState(project?.id);
  if (!project) return null;
  const editingZoom = project.edits.zooms.find((zoom) => zoom.id === selectedZoom);
  function editZoom(id: string) {
    if (!project) return;
    const zoom = project.edits.zooms.find((item) => item.id === id);
    if (!zoom) return;
    selectEditorTarget({ kind: "zoom", id });
    const time = targetPreviewTime(project, { kind: "zoom", id }, playback.getSnapshot().timeMs);
    if (time !== null) void seek(time);
    setModal("zoom");
  }
  return (
    <>
      <div className="editor-layout">
        <div className="preview-toolbar" data-tauri-drag-region>
          <span>
            <Clapperboard size={14} />
            {project.source ? "Preview" : "Recording studio"}
          </span>
          <div>
            {project.source && (
              <span className="resolution-tag">
                {project.source.width} × {project.source.height}
                <span>•</span>
                {project.source.fps} fps
              </span>
            )}
            <span className="preview-fit">Fit</span>
          </div>
        </div>
        <div className="editor-workspace">
          <nav className="tool-rail">
            <div className="tool-rail-controls">
              <IconButton label="Back to projects" onClick={() => void backToLibrary()}>
                <ArrowLeft />
              </IconButton>
              <div className="rail-divider" />
              {tabItems.map((item) => (
                <button
                  key={item.id}
                  className={`rail-tool ${tab === item.id ? "active" : ""}`}
                  aria-label={item.title}
                  aria-pressed={tab === item.id}
                  title={item.title}
                  onClick={() => {
                    if (item.id === tab) return;
                    if (item.id === "export") selectEditorTarget(null);
                    if (
                      item.id === "camera" &&
                      project.source?.camera &&
                      selection.endMs > selection.startMs
                    )
                      selectEditorTarget({
                        kind: "camera",
                        range: selection,
                        source: cameraSource(project),
                      });
                    else {
                      setSelection(selection);
                      setTab(item.id);
                    }
                  }}
                >
                  <item.icon size={19} />
                  <span>{item.title} </span>
                </button>
              ))}
            </div>
          </nav>
          <main className="editor-main">
            {project.source && <EditorQuickStart onHelp={() => setModal("help")} />}
            {project.source ? (
              <NativePreview
                project={project}
                hidden={Boolean(modal)}
                onError={setError}
                playback={playback}
                selection={selection}
                cameraScope={cameraScope}
                selected={
                  editorTarget?.kind === "camera"
                    ? { kind: "camera" }
                    : editorTarget?.kind === "overlay"
                      ? { kind: "overlay", id: editorTarget.id }
                      : null
                }
                onSelect={(item) => {
                  if (item?.kind === "camera") {
                    const scope = tab === "camera" ? cameraScope : "selection";
                    const range = previewCameraRange(
                      project,
                      playback.getSnapshot().timeMs,
                      selection,
                      scope,
                      editorTarget?.kind === "camera",
                    );
                    if (range) {
                      selectEditorTarget({
                        kind: "camera",
                        range,
                        source: cameraSource(project),
                        scope,
                      });
                      return { selection: range, cameraScope: scope };
                    }
                  } else if (item?.kind === "overlay" && item.id) {
                    selectEditorTarget({ kind: "overlay", id: item.id });
                  } else selectEditorTarget(null);
                }}
                apply={apply}
                disabled={projectBusy}
              />
            ) : (
              <div className="record-empty">
                <span className="record-empty-icon">
                  <Video size={33} strokeWidth={1.3} />
                </span>
                <div className="eyebrow">THE FLOOR IS YOURS</div>
                <h2>Ready when you are.</h2>
                <p>
                  Pick your screen, turn on your camera,
                  <br />
                  and bring your idea to life.
                </p>
                <button
                  className="button primary large"
                  disabled={busy || recording.active}
                  onClick={() => setModal("record")}
                >
                  <Circle size={16} fill="currentColor" />
                  Set up recording
                </button>
                <button
                  className="button secondary"
                  disabled={busy || recording.active}
                  onClick={() => void importVideo()}
                >
                  Import video
                </button>
                <span className="record-empty-note">
                  <Mic size={12} />
                  Separate screen, camera & audio tracks
                </span>
              </div>
            )}
            <PlaybackToolbar
              project={project}
              total={total}
              playback={playback}
              disabled={projectBusy}
            />
          </main>
          <aside className="inspector">
            <div className="inspector-title" data-tauri-drag-region>
              <span>
                {tab === "clip" ? "Video clip" : tabItems.find((i) => i.id === tab)?.title}
              </span>
              {tab === "ai" && <span className="mini-tag">BYOK</span>}
            </div>
            <div className="inspector-body" ref={inspectorRef}>
              <fieldset disabled={projectBusy} className="unstyled-fieldset">
                {tab === "clip" && editorTarget?.kind === "clip" && (
                  <SelectedClipPanel
                    project={project}
                    selection={selection}
                    index={editorTarget.index}
                    playback={playback}
                    disabled={projectBusy}
                    apply={apply}
                    panelRef={clipPanelRef}
                  />
                )}
                {tab === "clip" && editorTarget?.kind !== "clip" && (
                  <p className="helper">
                    Select a video clip to edit its timing, speed or position.
                  </p>
                )}
                {tab === "general" && (
                  <CanvasPanel
                    project={project}
                    apply={apply}
                    importImage={importImage}
                    onError={setError}
                  />
                )}
                {tab === "camera" && (
                  <CameraPanel
                    project={project}
                    selection={selection}
                    cameraScope={cameraScope}
                    onScopeChange={(scope) => {
                      const range = previewCameraRange(
                        project,
                        playback.getSnapshot().timeMs,
                        selection,
                        scope,
                        cameraScope === "selection",
                      );
                      if (range)
                        selectEditorTarget({
                          kind: "camera",
                          range,
                          source: cameraSource(project),
                          scope,
                        });
                      else setCameraScope(scope);
                    }}
                    apply={apply}
                  />
                )}
                {tab === "zoom" && (
                  <ZoomPanel
                    project={project}
                    selection={selection}
                    apply={apply}
                    selectedId={editorTarget?.kind === "zoom" ? editorTarget.id : null}
                    onEdit={editZoom}
                    onSelect={(id) => selectEditorTarget(id ? { kind: "zoom", id } : null)}
                  />
                )}
                {tab === "overlays" && (
                  <OverlaysPanel
                    project={project}
                    selection={selection}
                    apply={apply}
                    importImage={importImage}
                    onError={setError}
                    selected={editorTarget?.kind === "overlay" ? editorTarget.id : null}
                    onSelect={(id) => {
                      selectEditorTarget(id ? { kind: "overlay", id } : null);
                      if (!id) return;
                      const time = targetPreviewTime(
                        project,
                        { kind: "overlay", id },
                        playback.getSnapshot().timeMs,
                      );
                      if (time !== null) void seek(time);
                    }}
                  />
                )}
                {tab === "audio" && (
                  <>
                    <PanelIntro
                      title={editorTarget?.kind === "audio" ? "Audio clip" : "Video audio"}
                      text={
                        editorTarget?.kind === "audio"
                          ? "Timing and volume apply only to this imported audio clip."
                          : "The recorded audio mix applies to the entire video. Imported clips have their own volume."
                      }
                    />
                    {editorTarget?.kind !== "audio" && (
                      <>
                        <h3 className="panel-section">VIDEO DEFAULT MIX</h3>
                        <Slider
                          label={
                            project.source?.microphone === project.source?.screen
                              ? "Video audio"
                              : "Microphone"
                          }
                          value={project.edits.audio.microphoneVolume}
                          max={2}
                          onPreview={(v) =>
                            draftPreview([
                              { type: "audio.update", settings: { microphoneVolume: v } },
                            ])
                          }
                          onChange={(v) =>
                            void apply([
                              {
                                type: "audio.update",
                                settings: { microphoneVolume: v },
                              },
                            ])
                          }
                        />
                        <Slider
                          label="System audio"
                          value={project.edits.audio.systemVolume}
                          max={2}
                          onPreview={(v) =>
                            draftPreview([{ type: "audio.update", settings: { systemVolume: v } }])
                          }
                          onChange={(v) =>
                            void apply([
                              {
                                type: "audio.update",
                                settings: { systemVolume: v },
                              },
                            ])
                          }
                        />
                        <div className="panel-divider" />
                      </>
                    )}
                    <AudioClipsPanel
                      selectedId={editorTarget?.kind === "audio" ? editorTarget.id : null}
                      onSelect={(id) => selectEditorTarget({ kind: "audio", id })}
                      project={project}
                      selection={selection}
                      apply={apply}
                      importAudio={importAudio}
                      onError={setError}
                    />
                    <h3 className="panel-section">SMART CLEANUP</h3>
                    <p className="helper">
                      Find pauses using the recorded audio. Review every suggested cut before
                      applying it.
                    </p>
                    <SilenceControls
                      disabled={!project.source}
                      onAnalyze={(params) =>
                        void startJob("ai.cleanSilence", {
                          ...params,
                          apply: false,
                          expectedRevision: project.revision,
                        })
                      }
                    />
                    {silenceReview && (
                      <div className="review-card">
                        <strong>
                          {silenceReview.ranges.length
                            ? `${silenceReview.ranges.length} pauses found`
                            : "No pauses found"}
                        </strong>
                        <p>{formatTime(silenceReview.removedMs)} can be removed.</p>
                        <div className="review-ranges">
                          {silenceReview.ranges.map((r, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setSelection(r);
                                void seek(r.startMs);
                              }}
                            >
                              {seconds(r.startMs)}s – {seconds(r.endMs)}s
                            </button>
                          ))}
                        </div>
                        {silenceReview.ranges.length > 0 && (
                          <button
                            className="button primary full"
                            onClick={() => {
                              void (async () => {
                                await apply(silenceReview.operations, silenceReview.revision);
                                setSilenceReview(null);
                              })();
                            }}
                          >
                            <Scissors size={14} />
                            Apply cuts
                          </button>
                        )}
                        <button
                          className="button subtle full"
                          onClick={() => setSilenceReview(null)}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </>
                )}
                {tab === "transcript" && (
                  <TranscriptPanel
                    project={project}
                    settings={settings}
                    apply={apply}
                    onJob={startJob}
                    onSelect={(range) => {
                      setSelection(range);
                      void seek(range.startMs);
                    }}
                    onExport={exportTranscript}
                  />
                )}
                {tab === "export" && (
                  <ExportPanel
                    project={project}
                    busy={busy}
                    onExport={exportVideo}
                    onError={setError}
                  />
                )}
              </fieldset>
              {tab === "ai" && (
                <AssistantPanel
                  messages={chats[project.id] || []}
                  settings={settings}
                  disabled={projectBusy || !project.source}
                  onSettings={() => setModal("settings")}
                  onSend={async (prompt) => {
                    setChats((c) => ({
                      ...c,
                      [project.id]: [...(c[project.id] || []), { role: "user", text: prompt }],
                    }));
                    await startJob("ai.assistant", {
                      prompt,
                      provider: settings?.provider,
                    });
                  }}
                />
              )}
            </div>
          </aside>
        </div>
      </div>
      <LiveTimeline
        insertMedia={insertMedia}
        project={project}
        total={total}
        playback={playback}
        selection={selection}
        setSelection={setSelection}
        target={editorTarget}
        onSelectTarget={selectEditorTarget}
        seek={seek}
        apply={apply}
        disabled={projectBusy || Boolean(modal)}
        beginScrub={playback.beginScrub}
        endScrub={playback.endScrub}
        onCameraLayout={() =>
          selectEditorTarget({ kind: "camera", range: selection, source: cameraSource(project) })
        }
        onEditZoom={editZoom}
      />
      {modal === "zoom" && editingZoom && (
        <ZoomSettingsDialog
          project={project}
          zoom={editingZoom}
          apply={apply}
          disabled={projectBusy}
          onClose={() => setModal(null)}
        />
      )}
      <div className="editor-status">
        <span>
          <span className="connection-dot online" />
          Local project<span className="status-separator">/</span>
          {project.source
            ? `${project.edits.segments.length} clip${project.edits.segments.length === 1 ? "" : "s"}`
            : "Draft"}
          {project.recovered && <span className="recovered">Recovered after an interruption</span>}
          <span className={`status-save ${saveState}`} role="status">
            {saveState === "saving"
              ? "Saving changes…"
              : saveState === "failed"
                ? "Change could not be saved"
                : "Saved automatically"}
          </span>
        </span>
        <span>
          <kbd>⌘ S</kbd> Save<span className="status-separator">·</span>
          <kbd>⌘ Z</kbd> Undo
        </span>
      </div>
    </>
  );
}

function PlaybackToolbar({
  project,
  total,
  playback,
  disabled,
}: {
  project: NonNullable<StudioController["project"]>;
  total: number;
  playback: StudioController["playback"];
  disabled: boolean;
}) {
  const { timeMs, playing } = useSyncExternalStore(playback.subscribe, playback.getSnapshot);
  const seek = playback.seek,
    togglePlayback = playback.toggle;
  const boundaries = [0];
  for (const segment of project.edits.segments)
    boundaries.push(boundaries.at(-1)! + segmentDuration(segment));
  const previousBoundary = boundaries.filter((time) => time < timeMs - 1).at(-1) ?? 0;
  const nextBoundary = boundaries.find((time) => time > timeMs + 1) ?? total;
  const unavailable = !project.source || disabled;
  return (
    <div className="playback-toolbar">
      <span className="playback-time">
        {formatTime(timeMs)}
        <span>/ {formatTime(total)}</span>
      </span>
      <div>
        <IconButton label="Go to start" disabled={unavailable} onClick={() => void seek(0)}>
          <SkipBack size={16} />
        </IconButton>
        <IconButton
          label="Previous clip boundary"
          disabled={unavailable}
          onClick={() => void seek(previousBoundary)}
        >
          <ChevronsLeft size={16} />
        </IconButton>
        <button
          className="playback-step"
          aria-label="Back 5 seconds"
          disabled={unavailable}
          onClick={() => void seek(timeMs - 5000)}
        >
          −5s
        </button>
        <button
          className="playback-step"
          aria-label="Back 1 second"
          disabled={unavailable}
          onClick={() => void seek(timeMs - 1000)}
        >
          −1s
        </button>
        <button
          className="play-button"
          disabled={unavailable}
          aria-label={playing ? "Pause preview" : "Play preview"}
          onClick={() => void togglePlayback()}
        >
          {playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>
        <button
          className="playback-step"
          aria-label="Forward 1 second"
          disabled={unavailable}
          onClick={() => void seek(timeMs + 1000)}
        >
          +1s
        </button>
        <button
          className="playback-step"
          aria-label="Forward 5 seconds"
          disabled={unavailable}
          onClick={() => void seek(timeMs + 5000)}
        >
          +5s
        </button>
        <IconButton
          label="Next clip boundary"
          disabled={unavailable}
          onClick={() => void seek(nextBoundary)}
        >
          <ChevronsRight size={16} />
        </IconButton>
        <IconButton label="Go to end" disabled={unavailable} onClick={() => void seek(total)}>
          <SkipForward size={16} />
        </IconButton>
      </div>
      <span className="playback-shortcut">
        <kbd>space</kbd> to play
      </span>
    </div>
  );
}
function LiveTimeline({
  playback,
  ...props
}: Omit<React.ComponentProps<typeof Timeline>, "timeMs"> & {
  playback: StudioController["playback"];
}) {
  const { timeMs } = useSyncExternalStore(playback.subscribe, playback.getSnapshot);
  return <Timeline {...props} timeMs={timeMs} />;
}

function SelectedClipPanel({
  project,
  selection,
  index,
  playback,
  disabled,
  apply,
  panelRef,
}: {
  project: NonNullable<StudioController["project"]>;
  selection: { startMs: number; endMs: number };
  index: number;
  playback: StudioController["playback"];
  disabled: boolean;
  apply: StudioController["apply"];
  panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { timeMs } = useSyncExternalStore(playback.subscribe, playback.getSnapshot);
  const { intervals } = useTimelineGeometry(project, duration(project.edits.segments), selection);
  const clip = intervals[index];
  if (!clip) return null;
  return (
    <>
      <p className="selection-context">
        Clip {index + 1} · {formatTimecode(clip.outputStart)}–{formatTimecode(clip.outputEnd)}
      </p>
      <p className="helper">
        Changes apply to this video clip. Camera and effects stay aligned with their source footage.
      </p>
      <ClipContextMenu
        embedded
        menuRef={panelRef}
        position={{ x: 0, y: 0 }}
        project={project}
        intervals={intervals}
        clip={clip}
        timeMs={timeMs}
        disabled={disabled}
        close={() => {}}
        apply={(operations) => void apply(operations)}
      />
    </>
  );
}
