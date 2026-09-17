import { LoaderCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Field } from "@/src/components/molecules/Field";
import { Dialog } from "@/src/components/organisms/Dialog";
import { CaptureDialog } from "@/src/features/recording/CaptureDialog";
import { SettingsDialog } from "@/src/features/settings/SettingsDialog";
import { ExportDialog } from "@/src/features/export/ExportDialog";
import { type StudioController } from "@/src/controllers/useStudioController";
import { AboutDialog } from "@/src/components/organisms/AuthorFooter";
import { HelpDialog } from "@/src/features/help/HelpDialog";

export function StudioDialogs({
  studio,
}: {
  studio: Pick<
    StudioController,
    | "project"
    | "capabilities"
    | "modal"
    | "setModal"
    | "actionProject"
    | "setError"
    | "busy"
    | "settings"
    | "models"
    | "startJob"
    | "projectLocked"
    | "createProject"
    | "commitRename"
    | "confirmDelete"
    | "refreshCapabilities"
    | "startRecording"
    | "saveSettings"
    | "saveKey"
    | "exportVideo"
  >;
}) {
  const {
    project,
    capabilities,
    modal,
    setModal,
    actionProject,
    setError,
    busy,
    settings,
    models,
    startJob,
    projectLocked,
    createProject,
    commitRename,
    confirmDelete,
    refreshCapabilities,
    startRecording,
    saveSettings,
    saveKey,
    exportVideo,
  } = studio;
  return (
    <>
      {modal === "about" && <AboutDialog onClose={() => setModal(null)} />}
      {modal === "help" && <HelpDialog onClose={() => setModal(null)} />}
      {modal === "new" && (
        <Dialog
          title="A fresh canvas."
          subtitle="Give your next video a place to begin."
          onClose={() => !busy && setModal(null)}
        >
          <form onSubmit={createProject}>
            <Field label="Project name">
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus -- Focus the name field inside a newly opened modal.
                autoFocus
                name="name"
                placeholder="e.g. My next great tutorial"
                required
                maxLength={200}
                autoComplete="off"
              />
            </Field>
            <div className="dialog-note">
              <ShieldCheck size={16} />
              <span>Saved on your device. Always yours to edit.</span>
            </div>
            <div className="dialog-actions">
              <button type="button" className="button subtle" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />}
                Create project
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "rename" && actionProject && (
        <Dialog
          title="Rename project"
          subtitle="A good name makes your ideas easier to find."
          onClose={() => !busy && setModal(null)}
        >
          <form onSubmit={commitRename}>
            <Field label="Project name">
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus -- Focus the name field inside a newly opened modal.
                autoFocus
                name="name"
                defaultValue={actionProject.name}
                required
                maxLength={200}
              />
            </Field>
            <div className="dialog-actions">
              <button type="button" className="button subtle" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                Save name
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "delete" && actionProject && (
        <Dialog
          title="Move project to Trash?"
          subtitle={`“${actionProject.name}” and its source recordings will be moved to the macOS Trash. Your exported videos will be kept.`}
          onClose={() => !busy && setModal(null)}
        >
          <div className="dialog-note">
            <Trash2 size={16} />
            <span>You can restore the folder from the Trash and open it again.</span>
          </div>
          <div className="dialog-actions">
            <button className="button subtle" onClick={() => setModal(null)}>
              Keep project
            </button>
            <button
              className="button danger-button"
              disabled={busy || projectLocked(actionProject.id)}
              onClick={confirmDelete}
            >
              <Trash2 size={14} />
              Move to Trash
            </button>
          </div>
        </Dialog>
      )}
      {modal === "record" && project && (
        <CaptureDialog
          capabilities={capabilities}
          busy={busy}
          onClose={() => setModal(null)}
          onRefresh={refreshCapabilities}
          onStart={startRecording}
        />
      )}
      {modal === "settings" && (
        <SettingsDialog
          settings={settings}
          mcp={capabilities?.mcp}
          models={models}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={saveSettings}
          onKey={saveKey}
          onDownload={(model) => {
            void (async () => {
              if (await startJob("ai.models/download", { model })) setModal(null);
            })();
          }}
        />
      )}
      {modal === "export" && project && (
        <ExportDialog
          project={project}
          busy={busy}
          onClose={() => setModal(null)}
          onExport={exportVideo}
          onError={setError}
        />
      )}
    </>
  );
}
