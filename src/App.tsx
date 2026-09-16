import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { IconButton } from "@/src/components/atoms/IconButton";
import { ErrorContext, DraftPreviewContext } from "@/src/controllers/StudioContexts";
import { useStudioController } from "@/src/controllers/useStudioController";
import { StudioHeader } from "@/src/components/organisms/StudioHeader";
import { ProjectsScreen } from "@/src/features/projects/ProjectsScreen";
import { EditorScreen } from "@/src/features/editor/EditorScreen";
import { RecordingHud } from "@/src/features/recording/RecordingHud";
import { JobNotifications } from "@/src/features/jobs/JobNotifications";
import { StudioDialogs } from "@/src/components/organisms/StudioDialogs";

export default function App() {
  const studio = useStudioController();
  const splashStartedAt = useRef(Date.now());
  const [splash, setSplash] = useState<"visible" | "leaving" | "hidden">(
    studio.desktop ? "visible" : "hidden",
  );
  const {
    desktop,
    project,
    recording,
    error,
    setError,
    notice,
    exportPath,
    setExportPath,
    connected,
    loading,
    draftPreview,
    initialize,
    activeJobs,
    openExport,
  } = studio;
  useEffect(() => {
    if (!desktop || loading || splash !== "visible") return;
    const delay = Math.max(0, 2500 - (Date.now() - splashStartedAt.current));
    const exit = window.setTimeout(() => setSplash("leaving"), delay);
    return () => window.clearTimeout(exit);
  }, [desktop, loading, splash]);
  useEffect(() => {
    if (splash !== "leaving") return;
    const hide = window.setTimeout(() => setSplash("hidden"), 260);
    return () => window.clearTimeout(hide);
  }, [splash]);
  const draftContext = useMemo(
    () => ({ send: draftPreview, scope: `${project?.id ?? ""}:${project?.revision ?? ""}` }),
    [draftPreview, project?.id, project?.revision],
  );
  useEffect(() => {
    const close = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null;
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(
        ".project-menu[open], .editor-project-menu[open], .timeline-range-options[open]",
      )) {
        if (
          (e instanceof KeyboardEvent && e.key === "Escape") ||
          (e.type === "pointerdown" && !menu.contains(target)) ||
          (e.type === "click" && target?.closest("button") && menu.contains(target))
        )
          menu.open = false;
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <ErrorContext.Provider value={error}>
      <DraftPreviewContext.Provider value={draftContext}>
        <div className={`app ${project ? "editing" : "library"} ${desktop ? "desktop" : ""}`}>
          {splash !== "hidden" && (
            <div
              className={`launch-splash ${splash}`}
              role="status"
              aria-label="Opening Recora Screen"
            >
              <div className="launch-splash-content">
                <svg className="launch-splash-logo" viewBox="0 0 64 64" aria-hidden="true">
                  <rect width="64" height="64" rx="16" />
                  <rect className="screen" x="14" y="17" width="36" height="27" rx="5" />
                  <circle cx="32" cy="30" r="7" />
                  <path d="M25 50h14" />
                </svg>
                <h1>
                  Recora Screen<span>.</span>
                </h1>
                <p>Record once. Edit less.</p>
              </div>
            </div>
          )}
          <StudioHeader studio={studio} />
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {!connected && <button onClick={() => void initialize()}>Reconnect</button>}
              <IconButton label="Dismiss error" onClick={() => setError("")}>
                <X size={14} />
              </IconButton>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}

          {!project ? <ProjectsScreen studio={studio} /> : <EditorScreen studio={studio} />}

          {recording.active && <RecordingHud studio={studio} />}
          {exportPath && !activeJobs.some((j) => j.kind === "export") && (
            <div className="export-complete" role="status">
              <Check size={17} />
              <div>
                <strong>Your export is ready</strong>
                <p>{exportPath.split("/").pop()}</p>
              </div>
              {desktop && (
                <button className="button secondary" onClick={openExport}>
                  Open export
                </button>
              )}
              <IconButton label="Dismiss export result" onClick={() => setExportPath("")}>
                <X size={13} />
              </IconButton>
            </div>
          )}
          {activeJobs.length > 0 && <JobNotifications studio={studio} />}

          <StudioDialogs studio={studio} />
        </div>
      </DraftPreviewContext.Provider>
    </ErrorContext.Provider>
  );
}
