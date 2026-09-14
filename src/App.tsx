import { useEffect, useMemo } from "react";
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
    draftPreview,
    initialize,
    activeJobs,
    openExport,
  } = studio;
  const draftContext = useMemo(
    () => ({ send: draftPreview, scope: `${project?.id ?? ""}:${project?.revision ?? ""}` }),
    [draftPreview, project?.id, project?.revision],
  );
  useEffect(() => {
    const close = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null;
      for (const menu of document.querySelectorAll<HTMLDetailsElement>("details[open]")) {
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
                <strong>Your video is ready</strong>
                <p>{exportPath.split("/").pop()}</p>
              </div>
              {desktop && (
                <button className="button secondary" onClick={openExport}>
                  Open video
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
