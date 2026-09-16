import { type EditOperation, type Project, type Zoom } from "@/shared/types";
import { Dialog } from "@/src/components/organisms/Dialog";
import { ZoomProperties } from "@/src/features/editor/panels/ZoomProperties";

export function ZoomSettingsDialog({
  project,
  zoom,
  apply,
  onClose,
  disabled,
}: {
  project: Project;
  zoom: Zoom;
  apply: (ops: EditOperation[]) => Promise<void>;
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <Dialog
      title="Zoom settings"
      subtitle="Adjust this zoom without leaving your place."
      onClose={onClose}
    >
      <fieldset disabled={disabled} className="unstyled-fieldset">
        <ZoomProperties
          key={zoom.id}
          zoom={zoom}
          project={project}
          apply={apply}
          onRemove={onClose}
        />
      </fieldset>
      <div className="dialog-actions">
        <button className="button primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}
