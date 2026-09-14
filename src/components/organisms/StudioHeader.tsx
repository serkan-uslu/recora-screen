import {
  ArrowDownToLine,
  Check,
  LoaderCircle,
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

export function StudioHeader({
  studio,
}: {
  studio: Pick<
    StudioController,
    | "project"
    | "setModal"
    | "busy"
    | "saveDraft"
    | "backToLibrary"
    | "history"
    | "renameProject"
    | "projectBusy"
  >;
}) {
  const { project, setModal, busy, saveDraft, backToLibrary, history, renameProject, projectBusy } =
    studio;
  if (!project) return null;
  return (
    <header className="app-header" data-tauri-drag-region>
      <button
        className="brand"
        onClick={() => project && void backToLibrary()}
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
      {project ? (
        <div className="project-heading">
          <span className="header-divider" />
          <button className="project-title" onClick={() => void renameProject(project)}>
            {project.name}
            <PencilLine size={12} />
          </button>
          <span className="save-indicator">
            {busy ? <LoaderCircle className="spin" size={12} /> : <Check size={12} />}
            {busy ? "Saving…" : "All changes saved"}
          </span>
        </div>
      ) : (
        <div className="top-navigation">
          <span className="active">Workspace</span>
          <span className="local-badge">
            <span />
            Local & private
          </span>
        </div>
      )}
      <div className="header-actions">
        {project && (
          <div className="history-actions">
            <IconButton
              label="Undo (⌘Z)"
              disabled={projectBusy}
              onClick={() => void history("undo")}
            >
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
        )}
        <IconButton label="Settings" onClick={() => setModal("settings")}>
          <Settings2 />
        </IconButton>
        {project && (
          <div className="output-actions">
            <button
              className="button subtle save-button"
              disabled={projectBusy}
              onClick={() => void saveDraft()}
            >
              <Save size={15} />
              Save draft
            </button>
            <button
              className="button primary"
              disabled={!project.source || projectBusy}
              onClick={() => setModal("export")}
            >
              <ArrowDownToLine size={15} />
              Export video
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
