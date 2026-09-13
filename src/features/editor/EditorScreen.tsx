import { useSyncExternalStore, useContext } from "react";
import { DraftPreviewContext } from "../../controllers/StudioContexts";
import {
  ArrowLeft,
  ArrowRight,
  Circle,
  Clapperboard,
  Mic,
  Pause,
  Play,
  Scissors,
  Video,
} from "lucide-react";
import { formatTime, outputRanges } from "../../../shared/timeline";
import { IconButton } from "../../components/atoms/IconButton";
import { Slider } from "../../components/molecules/Slider";
import { PanelIntro } from "../../components/molecules/PanelIntro";
import { NativePreview } from "./NativePreview";
import { CanvasPanel } from "./panels/CanvasPanel";
import { CameraPanel } from "./panels/CameraPanel";
import { ZoomPanel } from "./panels/ZoomPanel";
import { OverlaysPanel } from "./panels/OverlaysPanel";
import { SilenceControls } from "../audio/SilenceControls";
import { TranscriptPanel } from "../transcript/TranscriptPanel";
import { AssistantPanel } from "../assistant/AssistantPanel";
import { Timeline } from "./Timeline";
import { tabItems } from "./tabs";
import { seconds } from "../../lib/format";
import { type StudioController } from "../../controllers/useStudioController";

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
    | "setSelectedZoom"
    | "inspectorRef"
    | "setError"
    | "busy"
    | "playback"
    | "selectedOverlay"
    | "setSelectedOverlay"
    | "cameraScope"
    | "setCameraScope"
    | "selection"
    | "setSelection"
    | "settings"
    | "chats"
    | "setChats"
    | "silenceReview"
    | "setSilenceReview"
    | "total"
    | "importImage"
    | "apply"
    | "backToLibrary"
    | "seek"
    | "togglePlayback"
    | "startJob"
    | "projectBusy"
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
    setSelectedZoom,
    inspectorRef,
    setError,
    busy,
    playback,
    selectedOverlay,
    setSelectedOverlay,
    cameraScope,
    setCameraScope,
    selection,
    setSelection,
    settings,
    chats,
    setChats,
    silenceReview,
    setSilenceReview,
    total,
    importImage,
    apply,
    backToLibrary,
    seek,
    startJob,
    projectBusy,
  } = studio;
  const { send: draftPreview } = useContext(DraftPreviewContext);
  if (!project) return null;
  function revealRange(range: { startMs: number; endMs: number }) {
    const ranges = outputRanges(project!.edits.segments, range);
    const time = playback.getSnapshot().timeMs;
    const visible = ranges.find(item => time >= item.startMs && time < item.endMs) ?? ranges[0];
    if (visible) { setSelection(visible); void seek((visible.startMs + visible.endMs) / 2); }
  }
  return (
    <>
      <div className="editor-layout">
        <nav className="tool-rail">
          <IconButton
            label="Back to projects"
            onClick={() => void backToLibrary()}
          >
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
              onClick={() => setTab(item.id)}
            >
              <item.icon size={19} />
              <span>
                {item.id === "transcript"
                  ? "Captions"
                  : item.id === "overlays"
                    ? "Layers"
                    : item.id === "ai"
                      ? "AI"
                      : item.id === "zoom"
                        ? "Zoom"
                        : item.title}
              </span>
            </button>
          ))}
        </nav>
        <main className="editor-main">
          <div className="preview-toolbar">
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
          {project.source ? (
            <NativePreview
              project={project}
              hidden={Boolean(modal)}
              onError={setError}
              playback={playback}
              selection={selection}
              cameraScope={cameraScope}
              selected={tab === "camera" ? { kind: "camera" } : tab === "overlays" && selectedOverlay ? { kind: "overlay", id: selectedOverlay } : null}
              onSelect={item => { if (item?.kind === "camera") setTab("camera"); else if (item?.kind === "overlay") { setSelectedOverlay(item.id!); setTab("overlays"); } else setSelectedOverlay(null); }}
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
              <span className="record-empty-note">
                <Mic size={12} />
                Separate screen, camera & audio tracks
              </span>
            </div>
          )}
          <PlaybackToolbar project={project} total={total} playback={playback} disabled={projectBusy} />
        </main>
        <aside className="inspector">
          <div className="inspector-title">
            <span>{tabItems.find((i) => i.id === tab)?.title}</span>
            {tab === "ai" && <span className="mini-tag">BYOK</span>}
          </div>
          <div className="inspector-body" ref={inspectorRef}>
            <fieldset
              disabled={projectBusy}
              className="unstyled-fieldset"
            >
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
                  onScopeChange={setCameraScope}
                  apply={apply}
                />
              )}
              {tab === "zoom" && (
                <ZoomPanel
                  project={project}
                  selection={selection}
                  apply={apply}
                  selectedId={selectedZoom}
                  onSelect={id => {
                    setSelectedZoom(id);
                    const zoom = project.edits.zooms.find(item => item.id === id);
                    if (zoom) revealRange(zoom);
                  }}
                />
              )}
              {tab === "overlays" && (
                <OverlaysPanel
                  project={project}
                  selection={selection}
                  apply={apply}
                  importImage={importImage}
                  onError={setError}
                  selected={selectedOverlay}
                  onSelect={id => {
                    setSelectedOverlay(id);
                    const overlay = project.edits.overlays.find(item => item.id === id);
                    if (overlay) revealRange(overlay);
                  }}
                />
              )}
              {tab === "audio" && (
                <>
                  <PanelIntro
                    title="A little clarity goes a long way."
                    text="Balance your voice and the sounds on your screen."
                  />
                  <h3 className="panel-section">MIXER</h3>
                  <Slider
                    label="Microphone"
                    value={project.edits.audio.microphoneVolume}
                    max={2}
                    onPreview={v => draftPreview([{ type: "audio.update", settings: { microphoneVolume: v } }])}
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
                    onPreview={v => draftPreview([{ type: "audio.update", settings: { systemVolume: v } }])}
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
                  <h3 className="panel-section">SMART CLEANUP</h3>
                  <p className="helper">
                    Find pauses using the recorded audio. Review every suggested
                    cut before applying it.
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
                      <p>
                        {formatTime(silenceReview.removedMs)} can be removed.
                      </p>
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
                          onClick={async () => {
                            await apply(
                              silenceReview.operations,
                              silenceReview.revision,
                            );
                            setSilenceReview(null);
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
                    [project.id]: [
                      ...(c[project.id] || []),
                      { role: "user", text: prompt },
                    ],
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
      <LiveTimeline
        project={project}
        total={total}
        playback={playback}
        selection={selection}
        setSelection={setSelection}
        seek={seek}
        apply={apply}
        disabled={projectBusy}
        selectedZoom={selectedZoom}
        beginScrub={playback.beginScrub}
        endScrub={playback.endScrub}
        onSelectOverlay={id => { setSelectedOverlay(id); setTab("overlays"); }}
        onCameraLayout={() => { setCameraScope("selection"); setTab("camera"); }}
        onSelectZoom={(id) => {
          setSelectedZoom(id);
          setTab("zoom");
        }}
      />
      <div className="editor-status">
        <span>
          <span className="connection-dot online" />
          Local project<span className="status-separator">/</span>
          {project.source
            ? `${project.edits.segments.length} clip${project.edits.segments.length === 1 ? "" : "s"}`
            : "Draft"}
          {project.recovered && (
            <span className="recovered">Recovered after an interruption</span>
          )}
        </span>
        <span>
          <kbd>⌘ S</kbd> Save<span className="status-separator">·</span>
          <kbd>⌘ Z</kbd> Undo
        </span>
      </div>
    </>
  );
}

function PlaybackToolbar({ project, total, playback, disabled }: { project: NonNullable<StudioController["project"]>; total: number; playback: StudioController["playback"]; disabled: boolean }) {
  const { timeMs, playing } = useSyncExternalStore(playback.subscribe, playback.getSnapshot);
  const seek = playback.seek, togglePlayback = playback.toggle;
  return (          <div className="playback-toolbar">
            <span className="playback-time">
              {formatTime(timeMs)}
              <span>/ {formatTime(total)}</span>
            </span>
            <div>
              <IconButton
                label="Go to start"
                disabled={!project.source}
                onClick={() => void seek(0)}
              >
                <ArrowLeft size={16} />
              </IconButton>
              <button
                className="play-button"
                disabled={!project.source || disabled}
                aria-label={playing ? "Pause preview" : "Play preview"}
                onClick={() => void togglePlayback()}
              >
                {playing ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
              </button>
              <IconButton
                label="Go to end"
                disabled={!project.source}
                onClick={() => void seek(total)}
              >
                <ArrowRight size={16} />
              </IconButton>
            </div>
            <span className="playback-shortcut">
              <kbd>space</kbd> to play
            </span>
          </div>);
}
function LiveTimeline({ playback, ...props }: Omit<React.ComponentProps<typeof Timeline>, "timeMs"> & { playback: StudioController["playback"] }) {
  const { timeMs } = useSyncExternalStore(playback.subscribe, playback.getSnapshot);
  return <Timeline {...props} timeMs={timeMs} />;
}
