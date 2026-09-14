import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { command, messageOf } from "@/src/api";
import type { RunAction } from "@/src/controllers/controllerTypes";
import { idleRecording } from "@/src/lib/format";
import type { EditOperation, Job, Project, Range, RecordingStatus } from "@/shared/types";

type SilenceReview = {
  revision: number;
  ranges: Range[];
  removedMs: number;
  operations: EditOperation[];
};
type Chat = { role: "user" | "assistant"; text: string };

export function useJobsController({
  connected,
  desktop,
  project,
  projectRef,
  recordingBusyRef,
  run,
  setRecording,
  setError,
  setNotice,
  setChats,
  acceptCurrentProject,
  refreshProjects,
  refreshSettings,
}: {
  connected: boolean;
  desktop: boolean;
  project: Project | null;
  projectRef: RefObject<Project | null>;
  recordingBusyRef: RefObject<boolean>;
  run: RunAction;
  setRecording: Dispatch<SetStateAction<RecordingStatus>>;
  setError: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setChats: Dispatch<SetStateAction<Record<string, Chat[]>>>;
  acceptCurrentProject: (project: Project) => void;
  refreshProjects: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [exportPath, setExportPath] = useState("");
  const [silenceReview, setSilenceReview] = useState<SilenceReview | null>(null);
  const handledJobs = useRef(new Set<string>());
  const initializedJobs = useRef(false);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    let polling = false;
    async function poll() {
      if (polling) return;
      polling = true;
      try {
        const [nextJobs, nextRecording] = await Promise.all([
          command<Job[]>("jobs.list"),
          desktop ? command<RecordingStatus>("recording.status") : Promise.resolve(idleRecording),
        ]);
        if (cancelled) return;
        setJobs((previous) =>
          JSON.stringify(previous) === JSON.stringify(nextJobs) ? previous : nextJobs,
        );
        if (!recordingBusyRef.current)
          setRecording((previous) =>
            JSON.stringify(previous) === JSON.stringify(nextRecording) ? previous : nextRecording,
          );
        if (!initializedJobs.current) {
          for (const job of nextJobs)
            if (["completed", "failed", "cancelled"].includes(job.status))
              handledJobs.current.add(job.id);
          initializedJobs.current = true;
        }
        if (nextRecording.error) setError(nextRecording.error);
        for (const job of nextJobs) {
          if (
            !["completed", "failed", "cancelled"].includes(job.status) ||
            handledJobs.current.has(job.id)
          )
            continue;
          handledJobs.current.add(job.id);
          if (job.status === "failed") setError(job.error || job.message);
          if (job.status !== "completed") continue;
          if (job.kind === "model") await refreshSettings();
          if (
            job.kind === "silence" &&
            job.projectId === projectRef.current?.id &&
            job.result &&
            typeof job.result === "object" &&
            "operations" in job.result
          )
            setSilenceReview(job.result as SilenceReview);
          if (job.kind === "assistant" && job.projectId) {
            const text = (job.result as { message?: string })?.message || "Your edits are ready.";
            setChats((current) => ({
              ...current,
              [job.projectId!]: [...(current[job.projectId!] || []), { role: "assistant", text }],
            }));
          }
          if (
            job.projectId &&
            job.projectId === projectRef.current?.id &&
            ["transcribe", "assistant", "silence"].includes(job.kind)
          )
            acceptCurrentProject(
              await command<Project>("project.open", { projectId: job.projectId }),
            );
          if (job.kind === "export") {
            setNotice("Export complete. Your project is still editable.");
            const path = (job.result as { path?: string })?.path;
            if (path) setExportPath(path);
          }
          await refreshProjects();
        }
      } catch (error) {
        if (!cancelled) setError(messageOf(error));
      } finally {
        polling = false;
      }
    }
    void poll();
    const id = setInterval(() => void poll(), 1400);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    acceptCurrentProject,
    connected,
    desktop,
    projectRef,
    recordingBusyRef,
    refreshProjects,
    refreshSettings,
    setChats,
    setError,
    setNotice,
    setRecording,
  ]);

  async function startJob(method: string, params: Record<string, unknown> = {}) {
    return run(async () => {
      const job = await command<Job>(method, {
        ...(method === "ai.models/download" ? {} : { projectId: project?.id }),
        ...params,
      });
      if (job?.id) setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      return job;
    });
  }

  function cancelJob(jobId: string) {
    return void run(async () => {
      await command("jobs.cancel", { jobId });
    });
  }

  return {
    jobs,
    activeJobs: jobs.filter((job) => job.status === "running" || job.status === "queued"),
    startJob,
    cancelJob,
    exportPath,
    setExportPath,
    silenceReview,
    setSilenceReview,
  };
}
