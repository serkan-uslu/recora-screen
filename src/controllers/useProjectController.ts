import {
  useState,
  useSyncExternalStore,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { projectSaveState, subscribeProjectSave } from "@/src/services/projectSaveState";
import { command, pickPath } from "@/src/api";
import type { RunAction } from "@/src/controllers/controllerTypes";
import type { Modal } from "@/src/controllers/studioTypes";
import type { Project, RecordingStatus } from "@/shared/types";

export function useProjectSaveState(projectId: string | undefined) {
  return useSyncExternalStore(subscribeProjectSave, () => projectSaveState(projectId));
}

export function useProjectController({
  project,
  recording,
  run,
  setProject,
  setModal,
  setNotice,
  acceptCurrentProject,
  refreshProjects,
  cancelDraftPreview,
}: {
  project: Project | null;
  recording: RecordingStatus;
  run: RunAction;
  setProject: Dispatch<SetStateAction<Project | null>>;
  setModal: Dispatch<SetStateAction<Modal>>;
  setNotice: Dispatch<SetStateAction<string>>;
  acceptCurrentProject: (project: Project) => void;
  refreshProjects: () => Promise<void>;
  cancelDraftPreview: () => void;
}) {
  const [actionProject, setActionProject] = useState<Pick<
    Project,
    "id" | "name" | "revision"
  > | null>(null);

  async function saveDraft() {
    if (!project || (recording.active && recording.projectId === project.id)) return;
    await run(async () => {
      acceptCurrentProject(await command<Project>("project.save", { projectId: project.id }));
      setNotice("Project saved");
      await refreshProjects();
    });
  }

  async function openProject(id: string) {
    cancelDraftPreview();
    await run(async () => {
      if (project && !(recording.active && recording.projectId === project.id))
        await command("project.save", { projectId: project.id });
      setProject(await command<Project>("project.open", { projectId: id }));
    });
  }

  async function backToLibrary() {
    cancelDraftPreview();
    await run(async () => {
      if (project && !(recording.active && recording.projectId === project.id))
        await command("project.save", { projectId: project.id });
      await command("preview.pause").catch(() => {});
      setProject(null);
      await refreshProjects();
    });
  }

  async function importProject(kind: "project" | "video" = "project") {
    await run(async () => {
      const path = await pickPath(kind);
      if (!path) return;
      cancelDraftPreview();
      const imported = await command<Project>("project.import", { path });
      await refreshProjects();
      setProject(imported);
      setModal(null);
    });
  }

  async function startRecordingProject() {
    if (recording.active) return;
    await run(async () => {
      const created = await command<Project>("project.create");
      setProject(created);
      setModal("record");
      await refreshProjects();
    });
  }

  function renameProject(selected: Pick<Project, "id" | "name" | "revision">) {
    setActionProject(selected);
    setModal("rename");
  }

  function deleteProject(selected: Pick<Project, "id" | "name" | "revision">) {
    setActionProject(selected);
    setModal("delete");
  }

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "").trim();
    if (!name) return;
    void run(async () => {
      const created = await command<Project>("project.create", { name });
      setProject(created);
      setModal(null);
      await refreshProjects();
    });
  }

  function commitRename(event: FormEvent<HTMLFormElement>) {
    if (!actionProject) return;
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "").trim();
    if (!name) return;
    void run(async () => {
      const next = await command<Project>("project.rename", {
        projectId: actionProject.id,
        name,
        expectedRevision: actionProject.revision,
      });
      acceptCurrentProject(next);
      await refreshProjects();
      setModal(null);
    });
  }

  function confirmDelete() {
    if (!actionProject) return;
    return void run(async () => {
      await command("project.delete", {
        projectId: actionProject.id,
        expectedRevision: actionProject.revision,
      });
      if (project?.id === actionProject.id) setProject(null);
      await refreshProjects();
      setModal(null);
      setNotice("Project moved to Trash");
    });
  }

  return {
    actionProject,
    saveDraft,
    openProject,
    backToLibrary,
    importProject,
    importVideo: () => importProject("video"),
    startRecordingProject,
    renameProject,
    deleteProject,
    createProject,
    commitRename,
    confirmDelete,
  };
}
