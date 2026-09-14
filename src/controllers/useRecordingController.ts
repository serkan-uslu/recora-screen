import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { command, messageOf } from "@/src/api";
import type { Modal } from "@/src/controllers/studioTypes";
import { idleRecording } from "@/src/lib/format";
import type { CaptureSettings, Project, RecordingStatus } from "@/shared/types";

export function useRecordingController({
  project,
  projectRef,
  setModal,
  setError,
  setNotice,
  acceptCurrentProject,
  refreshProjects,
}: {
  project: Project | null;
  projectRef: RefObject<Project | null>;
  setModal: Dispatch<SetStateAction<Modal>>;
  setError: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string>>;
  acceptCurrentProject: (project: Project) => void;
  refreshProjects: () => Promise<void>;
}) {
  const [recording, setRecording] = useState<RecordingStatus>(idleRecording);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const recordingBusyRef = useRef(false);

  async function runRecording(action: () => Promise<void>) {
    if (recordingBusyRef.current) return;
    recordingBusyRef.current = true;
    setRecordingBusy(true);
    try {
      await action();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      recordingBusyRef.current = false;
      setRecordingBusy(false);
    }
  }

  function toggleCameraVisibility() {
    void runRecording(async () =>
      setRecording(await command("recording.camera", { visible: !recording.cameraVisible })),
    );
  }

  function toggleCameraDevice() {
    void runRecording(async () =>
      setRecording(await command("recording.camera", { enabled: !recording.cameraEnabled })),
    );
  }

  function toggleRecordingPause() {
    void runRecording(async () =>
      setRecording(
        await command(`recording.${recording.paused ? "resume" : "pause"}`, {
          projectId: recording.projectId,
        }),
      ),
    );
  }

  function finishRecording() {
    void runRecording(async () => {
      setRecording((current) => ({ ...current, phase: "finalizing" }));
      try {
        const next = await command<Project>("recording.stop", { projectId: recording.projectId });
        acceptCurrentProject(next);
        setRecording(idleRecording);
        await refreshProjects();
        setNotice("Recording saved. Make it your own.");
      } finally {
        setRecording(await command<RecordingStatus>("recording.status"));
      }
    });
  }

  function startRecording(settings: CaptureSettings) {
    if (!project || recording.active) return;
    const id = project.id;
    setModal(null);
    setRecording({ ...idleRecording, active: true, projectId: id, phase: "starting" });
    void runRecording(async () => {
      try {
        setRecording(
          await command<RecordingStatus>("recording.start", { projectId: id, settings }),
        );
        if (projectRef.current?.id === id)
          acceptCurrentProject(await command<Project>("project.open", { projectId: id }));
        await refreshProjects();
      } catch (error) {
        setRecording(idleRecording);
        throw error;
      }
    });
  }

  return {
    recording,
    setRecording,
    recordingBusy,
    recordingBusyRef,
    startRecording,
    toggleCameraVisibility,
    toggleCameraDevice,
    toggleRecordingPause,
    finishRecording,
  };
}
