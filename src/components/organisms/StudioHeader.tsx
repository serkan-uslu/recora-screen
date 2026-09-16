import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  CircleHelp,
  LoaderCircle,
  MoreHorizontal,
  PencilLine,
  Redo2,
  Save,
  Settings2,
  Undo2,
} from "lucide-react";
import { IconButton } from "@/src/components/atoms/IconButton";
import { product } from "@/shared/brand";
import productIcon from "@/design-system/product-icon.svg";
import { type StudioController } from "@/src/controllers/useStudioController";
import { useProjectSaveState } from "@/src/controllers/useProjectController";

export function StudioHeader({
  studio,
}: {
  studio: Pick<
    StudioController,
    | "project"
    | "setModal"
    | "saveDraft"
    | "backToLibrary"
    | "history"
    | "renameProject"
    | "projectBusy"
  >;
}) {
  const { project, setModal, saveDraft, backToLibrary, history, renameProject, projectBusy } =
    studio;
  const saveState = useProjectSaveState(project?.id);
  if (!project)
    return <div className="library-titlebar" data-tauri-drag-region aria-hidden="true" />;
  return (
    <header className="app-header" data-tauri-drag-region>
      <button
        className="brand"
        onClick={() => void backToLibrary()}
        aria-label={`${product.name} projects`}
      >
        <span className="brand-mark">
          <img src={productIcon} width="32" height="32" alt="" />
        </span>
        <span>
          {product.name}
          <span className="brand-dot">.</span>
        </span>
      </button>
      <div className="project-heading">
        <span className="header-divider" />
        <button className="project-title" onClick={() => renameProject(project)}>
          {project.name}
          <PencilLine size={12} />
        </button>
        <span
          className={`save-indicator ${saveState}`}
          role="status"
          title="Edits save to this project on your Mac. Export video creates a separate video file."
        >
          {saveState === "saving" ? (
            <LoaderCircle className="spin" size={14} />
          ) : saveState === "failed" ? (
            <CircleAlert size={14} />
          ) : (
            <Check size={14} />
          )}
          {saveState === "saving"
            ? "Saving changes…"
            : saveState === "failed"
              ? "Change could not be saved"
              : "Saved automatically"}
        </span>
      </div>
      <div className="header-actions">
        <div className="history-actions">
          <IconButton label="Undo (⌘Z)" disabled={projectBusy} onClick={() => void history("undo")}>
            <Undo2 />
          </IconButton>
          <IconButton
            label="Redo (⇧⌘Z)"
            disabled={projectBusy}
            onClick={() => void history("redo")}
          >
            <Redo2 />
          </IconButton>
        </div>
        <button className="button subtle quick-start-button" onClick={() => setModal("help")}>
          <CircleHelp size={16} />
          Quick start
        </button>
        <details className="editor-project-menu">
          <summary aria-label="Project options" title="Project options">
            <MoreHorizontal size={20} />
          </summary>
          <div className="editor-project-menu-content">
            <button
              disabled={projectBusy}
              onClick={(event) => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                void saveDraft();
              }}
            >
              <Save size={15} />
              Save now <kbd>⌘S</kbd>
            </button>
            <button
              onClick={(event) => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                setModal("settings");
              }}
            >
              <Settings2 size={15} />
              Settings
            </button>
          </div>
        </details>
        <button
          className="button primary"
          disabled={!project.source || projectBusy}
          onClick={() => setModal("export")}
        >
          <ArrowDownToLine size={15} />
          Export video
        </button>
      </div>
    </header>
  );
}
