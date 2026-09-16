import { openPath } from "@tauri-apps/plugin-opener";
import { messageOf, pickPath } from "@/src/api";
import type { Modal } from "@/src/controllers/studioTypes";
import type { ExportOptions, Job, Project } from "@/shared/types";
import type { Dispatch, SetStateAction } from "react";

export function useExportController({
  project,
  exportPath,
  startJob,
  setModal,
  setError,
}: {
  project: Project | null;
  exportPath: string;
  startJob: (method: string, params?: Record<string, unknown>) => Promise<Job | undefined>;
  setModal: Dispatch<SetStateAction<Modal>>;
  setError: Dispatch<SetStateAction<string>>;
}) {
  function openExport() {
    return void openPath(exportPath).catch((error) => setError(messageOf(error)));
  }

  async function exportVideo(size: ExportOptions) {
    if (!project) return;
    const path = await pickPath(size.format === "gif" ? "gif" : "export", project.name);
    if (!path) return;
    const result = await startJob("export.start", { path, ...size });
    if (result) setModal(null);
  }

  return { openExport, exportVideo };
}
