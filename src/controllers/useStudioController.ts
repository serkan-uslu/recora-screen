import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  type AppCapabilities,
  type CaptureSettings,
  type EditOperation,
  type Job,
  type Project,
  type ProjectSummary,
  type Range,
  type RecordingStatus,
} from "../../shared/types";
import { createPreviewPlayback } from "./previewPlayback";
import { useStableCallback } from "./useStableCallback";
import { duration, outputRanges } from "../../shared/timeline";
import { command, desktop, messageOf, pickPath } from "../api";
import {
  type Modal,
  type Tab,
  type Settings,
  type McpConfig,
  type Model,
} from "./studioTypes";
import { idleRecording } from "../lib/format";

export const reconcileProjectRefresh = (current: Project | null, next: Project) =>
  current?.id === next.id && next.revision >= current.revision ? next : current;

export function useStudioController() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [capabilities, setCapabilities] = useState<
    (AppCapabilities & { mcp?: McpConfig | null }) | null
  >(null);
  const [recording, setRecording] = useState<RecordingStatus>(idleRecording);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [actionProject, setActionProject] = useState<Pick<
    Project,
    "id" | "name" | "revision"
  > | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [selectedZoom, setSelectedZoom] = useState<string | null>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab !== "zoom" || !selectedZoom)
      inspectorRef.current?.scrollTo({ top: 0 });
  }, [tab]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("modified");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playback] = useState(() => createPreviewPlayback(
    (method, params) => desktop ? command(method, params) : Promise.resolve(null),
    error => setError(messageOf(error)),
  ));
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const [cameraScope, setCameraScope] = useState<"selection" | "entire">("selection");
  const [recordingBusy, setRecordingBusy] = useState(false);
  const recordingBusyRef = useRef(false);
  const [selection, setSelection] = useState<Range>({ startMs: 0, endMs: 0 });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [chats, setChats] = useState<
    Record<string, { role: "user" | "assistant"; text: string }[]>
  >({});
  const [silenceReview, setSilenceReview] = useState<{
    revision: number;
    ranges: Range[];
    removedMs: number;
    operations: EditOperation[];
  } | null>(null);
  const handledJobs = useRef(new Set<string>());
  const initializedJobs = useRef(false);
  const pendingProjectChanges = useRef(
    new Map<string, { revision?: number; deleted?: boolean }>(),
  );
  const busyRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;
  function acceptCurrentProject(next: Project) {
    // Resolve against the latest React state, including project switches queued in this same turn.
    setProject(current => reconcileProjectRefresh(current, next));
  }
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPreview = useRef<{
    projectId: string;
    revision: number;
    operations: EditOperation[] | null;
    sequence: number;
    inputAtMs: number;
  } | null>(null);
  const previewRunning = useRef(false);
  const previewSequence = useRef(0);
  function cancelDraftPreview() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
    pendingPreview.current = null;
  }
  function scheduleDraftPreview() {
    if (
      previewTimer.current ||
      previewRunning.current ||
      !pendingPreview.current
    )
      return;
    previewTimer.current = setTimeout(async () => {
      previewTimer.current = null;
      const pending = pendingPreview.current;
      pendingPreview.current = null;
      if (
        !pending ||
        projectRef.current?.id !== pending.projectId ||
        projectRef.current?.revision !== pending.revision
      )
        return;
      previewRunning.current = true;
      try {
        await command(pending.operations === null ? "preview.reset" : "preview.draft", {
          projectId: pending.projectId,
          expectedRevision: pending.revision,
          ...(pending.operations === null ? {} : { operations: pending.operations }),
          sequence: pending.sequence,
          inputAtMs: pending.inputAtMs,
        });
      } catch {
        /* A stale preview is superseded by the next committed edit. */
      } finally {
        previewRunning.current = false;
        scheduleDraftPreview();
      }
    }, 16);
  }
  function draftPreview(operations: EditOperation[] | null) {
    const current = projectRef.current;
    if (!desktop || !capabilities?.nativeAvailable || !current?.source) return;
    pendingPreview.current = {
      projectId: current.id,
      revision: current.revision,
      operations,
      sequence: ++previewSequence.current,
      inputAtMs: Date.now(),
    };
    scheduleDraftPreview();
  }
  useEffect(() => () => cancelDraftPreview(), []);
  const total = project ? duration(project.edits.segments) : 0;
  async function importImage() {
    if (!project) return;
    const path = await pickPath("image");
    if (!path) return;
    const next = await command<Project>("asset.import", {
      projectId: project.id,
      path,
      expectedRevision: project.revision,
    });
    acceptCurrentProject(next);
    if (projectRef.current?.id !== next.id) return;
    return { asset: next.assets.at(-1), revision: next.revision };
  }
  const run = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | undefined> => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError("");
      try {
        return await action();
      } catch (e) {
        setError(messageOf(e));
        return undefined;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );
  const refreshProjects = useCallback(async () => {
    setProjects(await command<ProjectSummary[]>("project.list"));
  }, []);
  const refreshSettings = useCallback(async () => {
    const [nextSettings, nextModels] = await Promise.all([
      command<Settings>("settings.get"),
      command<Model[]>("ai.models/list"),
    ]);
    setSettings(nextSettings);
    setModels(nextModels);
  }, []);
  const initialize = useCallback(async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      refreshProjects(),
      command<AppCapabilities>("app.capabilities"),
      refreshSettings(),
    ]);
    setConnected(results[0].status === "fulfilled");
    if (results[1].status === "fulfilled") {
      setCapabilities(results[1].value);
      setRecording(results[1].value.recording);
    }
    const failure = results.find(
      (r, index) => r.status === "rejected" && (desktop || index !== 1),
    );
    if (failure?.status === "rejected") setError(messageOf(failure.reason));
    setLoading(false);
  }, [refreshProjects, refreshSettings]);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!desktop) return;
    const changed = listen<{
      projectId: string;
      revision?: number;
      deleted?: boolean;
    }>("project-changed", ({ payload }) => {
      pendingProjectChanges.current.set(payload.projectId, payload);
    });
    const blocked = listen<{ message?: string; reason?: string } | string>(
      "app-close-blocked",
      ({ payload }) => {
        setError(
          typeof payload === "string"
            ? payload
            : payload.message ||
                payload.reason ||
                "Finish or cancel the active recording or job before quitting.",
        );
      },
    );
    const shortcut = listen<{ message: string }>(
      "shortcut-error",
      ({ payload }) => setError(payload.message),
    );
    let refreshing = false;
    const timer = setInterval(async () => {
      if (busyRef.current || refreshing || !pendingProjectChanges.current.size)
        return;
      refreshing = true;
      const changes = new Map(pendingProjectChanges.current);
      pendingProjectChanges.current.clear();
      try {
        await refreshProjects();
        const current = projectRef.current;
        if (current && changes.get(current.id)?.deleted) {
          setProject(null);
          setNotice("This project was moved to Trash.");
        } else if (
          current &&
          changes.has(current.id) &&
          changes.get(current.id)?.revision !== current.revision
        ) {
          const next = await command<Project>("project.open", {
            projectId: current.id,
          });
          if (
            !busyRef.current &&
            projectRef.current?.id === next.id &&
            next.revision >= projectRef.current.revision
          )
            setProject(next);
          else
            pendingProjectChanges.current.set(next.id, {
              revision: next.revision,
            });
        }
      } catch (e) {
        setError(messageOf(e));
      } finally {
        refreshing = false;
      }
    }, 400);
    return () => {
      clearInterval(timer);
      void changed.then((unlisten) => unlisten());
      void blocked.then((unlisten) => unlisten());
      void shortcut.then((unlisten) => unlisten());
    };
  }, [refreshProjects]);
  useEffect(() => {
    if (!connected) return;
    let cancelled = false,
      polling = false;
    async function poll() {
      if (polling) return;
      polling = true;
      try {
        const [nextJobs, nextRecording] = await Promise.all([
          command<Job[]>("jobs.list"),
          desktop
            ? command<RecordingStatus>("recording.status")
            : Promise.resolve(idleRecording),
        ]);
        if (cancelled) return;
        setJobs(previous => JSON.stringify(previous) === JSON.stringify(nextJobs) ? previous : nextJobs);
        if (!recordingBusyRef.current)
          setRecording(previous => JSON.stringify(previous) === JSON.stringify(nextRecording) ? previous : nextRecording);
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
            setSilenceReview(job.result as NonNullable<typeof silenceReview>);
          if (job.kind === "assistant" && job.projectId) {
            const text =
              (job.result as { message?: string })?.message ||
              "Your edits are ready.";
            setChats((c) => ({
              ...c,
              [job.projectId!]: [
                ...(c[job.projectId!] || []),
                { role: "assistant", text },
              ],
            }));
          }
          if (
            job.projectId &&
            job.projectId === projectRef.current?.id &&
            ["transcribe", "assistant", "silence"].includes(job.kind)
          )
            acceptCurrentProject(
              await command<Project>("project.open", {
                projectId: job.projectId,
              }),
            );
          if (job.kind === "export") {
            setNotice("Export complete. Your project is still editable.");
            const path = (job.result as { path?: string })?.path;
            if (path) setExportPath(path);
          }
          await refreshProjects();
        }
      } catch (e) {
        if (!cancelled) setError(messageOf(e));
      } finally {
        polling = false;
      }
    }
    void poll();
    const id = setInterval(poll, 1400);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connected, refreshProjects, refreshSettings]);
  useEffect(() => {
    if (!project?.source || modal || !desktop) return;
    let cancelled = false;
    const id = setInterval(() => { if (!cancelled) void playback.poll(); }, 100);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [project?.id, project?.source, modal]);
  useEffect(() => {
    playback.reset(total);
    setSelection({ startMs: 0, endMs: 0 });
    setSilenceReview(null);
    setSelectedZoom(null);
    setSelectedOverlay(null);
    setCameraScope("selection");
  }, [project?.id]);
  useEffect(() => {
    playback.setDuration(total);
    setSelection((s) => ({
      startMs: Math.min(s.startMs, total),
      endMs: Math.min(s.endMs, total),
    }));
  }, [total]);
  async function apply(
    operations: EditOperation[],
    revision = project?.revision,
  ) {
    if (!project) return;
    cancelDraftPreview();
    await run(async () => {
      let next: Project;
      try {
        next = await command<Project>("timeline.apply", {
          projectId: project.id,
          expectedRevision: revision,
          operations,
        });
      } catch (error) {
        if (desktop && projectRef.current?.id === project.id)
          await command("preview.load", { projectId: project.id }).catch(
            () => {},
          );
        throw error;
      }
      if (projectRef.current?.id !== next.id) return;
      acceptCurrentProject(next);
      const zoom = next.edits.zooms.find(item => !project.edits.zooms.some(old => old.id === item.id));
      const overlay = next.edits.overlays.find(item => !project.edits.overlays.some(old => old.id === item.id));
      if (zoom && operations.some(op => op.type === "zoom.add")) {
        setSelectedZoom(zoom.id); setSelectedOverlay(null); setTab("zoom");
        const ranges = outputRanges(next.edits.segments, zoom);
        if (ranges[0]) await playback.seek((ranges[0].startMs + ranges[0].endMs) / 2);
      }
      if (overlay && operations.some(op => op.type === "overlay.add")) {
        setSelectedOverlay(overlay.id); setSelectedZoom(null); setTab("overlays");
        const ranges = outputRanges(next.edits.segments, overlay);
        if (ranges[0]) await playback.seek((ranges[0].startMs + ranges[0].endMs) / 2);
      }
      void refreshProjects();
    });
  }
  async function saveDraft() {
    if (!project || (recording.active && recording.projectId === project.id)) return;
    await run(async () => {
      acceptCurrentProject(
        await command<Project>("project.save", { projectId: project.id }),
      );
      setNotice("Draft saved");
      await refreshProjects();
    });
  }
  async function openProject(id: string) {
    cancelDraftPreview();
    await run(async () => {
      if (project && !(recording.active && recording.projectId === project.id)) await command("project.save", { projectId: project.id });
      setProject(await command<Project>("project.open", { projectId: id }));
    });
  }
  async function backToLibrary() {
    cancelDraftPreview();
    await run(async () => {
      if (project && !(recording.active && recording.projectId === project.id)) await command("project.save", { projectId: project.id });
      await command("preview.pause").catch(() => {});
      setProject(null);
      await refreshProjects();
    });
  }
  async function history(action: "undo" | "redo") {
    cancelDraftPreview();
    if (!project) return;
    await run(async () => {
      acceptCurrentProject(
        await command<Project>(`history.${action}`, {
          projectId: project.id,
          expectedRevision: project.revision,
        }),
      );
    });
  }
  const seek = playback.seek;
  const togglePlayback = playback.toggle;
  async function startJob(
    method: string,
    params: Record<string, unknown> = {},
  ) {
    return run(async () => {
      const job = await command<Job>(method, {
        ...(method === "ai.models/download" ? {} : { projectId: project?.id }),
        ...params,
      });
      if (job?.id)
        setJobs((j) => [job, ...j.filter((item) => item.id !== job.id)]);
      return job;
    });
  }
  async function importProject() {
    await run(async () => {
      const path = await pickPath("project");
      if (!path) return;
      const imported = await command<Project>("project.import", { path });
      await refreshProjects();
      setProject(imported);
    });
  }
  async function renameProject(p: Pick<Project, "id" | "name" | "revision">) {
    setActionProject(p);
    setModal("rename");
  }
  async function deleteProject(p: Pick<Project, "id" | "name" | "revision">) {
    setActionProject(p);
    setModal("delete");
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { timeMs } = playback.getSnapshot();
      if (e.defaultPrevented) return;
      const input = (e.target as HTMLElement).closest(
        'input, textarea, select, [contenteditable="true"]',
      );
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        void saveDraft();
      }
      if (modal || input) return;
      if (
        !e.metaKey &&
        !e.ctrlKey &&
        e.key.toLowerCase() === "s" &&
        project?.source &&
        !busyRef.current &&
        !(recording.active && recording.projectId === project?.id) &&
        timeMs > 0 &&
        timeMs < total
      ) {
        e.preventDefault();
        void apply([{ type: "split", atMs: timeMs }]);
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "r" &&
        project &&
        !project.source &&
        !recording.active
      ) {
        e.preventDefault();
        setModal("record");
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void history(e.shiftKey ? "redo" : "undo");
      }
      if (e.code === "Space" && project?.source) {
        e.preventDefault();
        void togglePlayback();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const activeJobs = jobs.filter(
    (j) => j.status === "running" || j.status === "queued",
  );
  const projectBusy =
    busy || (recording.active && recording.projectId === project?.id) || activeJobs.some((j) => j.projectId === project?.id);
  const filtered = projects
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : new Date(sort === "created" ? b.createdAt : b.updatedAt).getTime() -
          new Date(sort === "created" ? a.createdAt : a.updatedAt).getTime(),
    );
  const projectLocked = (id: string) =>
    (recording.active && recording.projectId === id) ||
    activeJobs.some((j) => j.projectId === id);
  async function runRecording(action: () => Promise<void>) {
    if (recordingBusyRef.current) return;
    recordingBusyRef.current = true; setRecordingBusy(true);
    try { await action(); } catch (error) { setError(messageOf(error)); }
    finally { recordingBusyRef.current = false; setRecordingBusy(false); }
  }
  function toggleCameraVisibility() {
    void runRecording(async () => setRecording(await command("recording.camera", { visible: !recording.cameraVisible })));
  }
  function toggleCameraDevice() {
    void runRecording(async () => setRecording(await command("recording.camera", { enabled: !recording.cameraEnabled })));
  }
  function toggleRecordingPause() {
    void runRecording(async () => setRecording(await command(`recording.${recording.paused ? "resume" : "pause"}`, { projectId: recording.projectId })));
  }
  function finishRecording() {
    void runRecording(async () => {
      setRecording(current => ({ ...current, phase: "finalizing" }));
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

  function openExport() {
    return void openPath(exportPath).catch((e) => setError(messageOf(e)));
  }

  function cancelJob(jobId: string) {
    return void run(async () => {
      await command("jobs.cancel", { jobId });
    });
  }

  function createProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") || "").trim();
    if (!name) return;
    void run(async () => {
      const created = await command<Project>("project.create", {
        name,
      });
      setProject(created);
      setModal(null);
      await refreshProjects();
    });
  }

  function commitRename(e: React.FormEvent<HTMLFormElement>) {
    if (!actionProject) return;
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") || "").trim();
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
      });
      if (project?.id === actionProject.id) setProject(null);
      await refreshProjects();
      setModal(null);
      setNotice("Project moved to Trash");
    });
  }

  function refreshCapabilities() {
    return run(async () =>
      setCapabilities(await command<AppCapabilities>("app.capabilities")),
    );
  }

  function startRecording(settings: CaptureSettings) {
    if (!project || recording.active) return;
    const id = project.id;
    setModal(null);
    setRecording({ ...idleRecording, active: true, projectId: id, phase: "starting" });
    void runRecording(async () => {
      try {
        setRecording(await command<RecordingStatus>("recording.start", { projectId: id, settings }));
        if (projectRef.current?.id === id)
          acceptCurrentProject(await command<Project>("project.open", { projectId: id }));
        await refreshProjects();
      } catch (error) { setRecording(idleRecording); throw error; }
    });
  }

  function saveSettings(params: Record<string, unknown>) {
    return void run(async () => {
      await command("settings.update", params);
      await refreshSettings();
      setNotice("Settings saved");
    });
  }

  async function saveKey(provider: string, key: string) {
    await run(async () => {
      await command(key ? "keychain.set" : "keychain.delete", {
        provider,
        ...(key ? { key } : {}),
      });
      await refreshSettings();
      setNotice(key ? "API key saved in Keychain" : "API key removed");
    });
  }

  async function exportVideo(size: { width: number; height: number }) {
    if (!project) return;
    const path = await pickPath("export", project.name);
    if (!path) return;
    const result = await startJob("export.start", {
      path,
      ...size,
    });
    if (result) setModal(null);
  }

  function exportTranscript(format: "srt" | "vtt") {
    if (!project) return;
    void run(async () => {
      const path = await pickPath(format, project.name);
      if (path)
        await command("transcript.export", {
          projectId: project.id,
          format,
          path,
        });
    });
  }
  return {
    exportTranscript,
    desktop,
    project,
    recording,
    error,
    setError,
    notice,
    exportPath,
    setExportPath,
    connected,
    draftPreview: useStableCallback(draftPreview),
    initialize,
    activeJobs,
    openExport,
    capabilities,
    modal,
    setModal,
    actionProject,
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
    saveDraft,
    backToLibrary,
    history,
    renameProject,
    projectBusy,
    tab,
    setTab,
    selectedZoom,
    setSelectedZoom,
    inspectorRef,
    playback,
    selectedOverlay,
    setSelectedOverlay,
    cameraScope,
    setCameraScope,
    recordingBusy,
    selection,
    setSelection,
    chats,
    setChats,
    silenceReview,
    setSilenceReview,
    total,
    importImage: useStableCallback(importImage),
    apply: useStableCallback(apply),
    seek,
    togglePlayback,
    cancelJob,
    projects,
    search,
    setSearch,
    sort,
    setSort,
    loading,
    openProject,
    importProject,
    deleteProject,
    filtered,
    toggleCameraVisibility,
    toggleCameraDevice,
    toggleRecordingPause,
    finishRecording,
  };
}
export type StudioController = ReturnType<typeof useStudioController>;
