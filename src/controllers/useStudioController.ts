import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  type AppCapabilities,
  type EditOperation,
  type Project,
  type ProjectSummary,
  type Range,
} from "@/shared/types";
import { createPreviewPlayback } from "@/src/controllers/previewPlayback";
import { useAssistantController } from "@/src/controllers/useAssistantController";
import { useExportController } from "@/src/controllers/useExportController";
import { useJobsController } from "@/src/controllers/useJobsController";
import { useProjectController } from "@/src/controllers/useProjectController";
import { useRecordingController } from "@/src/controllers/useRecordingController";
import { useStableCallback } from "@/src/controllers/useStableCallback";
import { duration, outputRanges, segmentDuration } from "@/shared/timeline";
import { command, desktop, messageOf, pickPath } from "@/src/api";
import { targetRange, targetAfterEdit, type EditorTarget } from "@/src/controllers/editorSelection";
import { type Modal, type Tab, type McpConfig } from "@/src/controllers/studioTypes";

export const reconcileProjectRefresh = (current: Project | null, next: Project) =>
  current?.id === next.id && next.revision >= current.revision ? next : current;

export function useStudioController() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [capabilities, setCapabilities] = useState<
    (AppCapabilities & { mcp?: McpConfig | null }) | null
  >(null);
  const [modal, setModal] = useState<Modal>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [selectedZoom, setSelectedZoom] = useState<string | null>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    inspectorRef.current?.scrollTo({ top: 0 });
  }, [tab, project?.id]);
  useEffect(() => {
    if (modal === "zoom" && !project?.edits.zooms.some((zoom) => zoom.id === selectedZoom))
      setModal(null);
  }, [modal, project, selectedZoom]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("modified");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playback] = useState(() =>
    createPreviewPlayback(
      (method, params) => (desktop ? command(method, params) : Promise.resolve(null)),
      (error) => setError(messageOf(error)),
    ),
  );
  const [cameraScope, setCameraScope] = useState<"selection" | "entire">("selection");
  const [selection, updateSelection] = useState<Range>({ startMs: 0, endMs: 0 });
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const editorTargetRef = useRef(editorTarget);
  editorTargetRef.current = editorTarget;
  const setSelection = useCallback((next: React.SetStateAction<Range>) => {
    editorTargetRef.current = null;
    setEditorTarget(null);
    updateSelection(next);
  }, []);
  function selectEditorTarget(target: EditorTarget | null, current = project) {
    editorTargetRef.current = target;
    setEditorTarget(target);
    if (!target || !current) {
      updateSelection({ startMs: 0, endMs: 0 });
      return;
    }
    const range = targetRange(current, target);
    if (range) updateSelection(range);
    if (target.kind === "clip") setTab("clip");
    else if (target.kind === "camera") {
      setCameraScope(target.scope ?? "selection");
      setTab("camera");
    } else if (target.kind === "zoom") {
      setSelectedZoom(target.id);
      setTab("zoom");
    } else if (target.kind === "overlay") {
      setTab("overlays");
    } else setTab("audio");
  }
  useEffect(() => {
    if (!project || !editorTarget) return;
    const range = targetRange(project, editorTarget);
    if (!range) {
      setEditorTarget(null);
      updateSelection({ startMs: 0, endMs: 0 });
    } else updateSelection({ startMs: range.startMs, endMs: range.endMs });
  }, [project, editorTarget]);
  const pendingProjectChanges = useRef(new Map<string, { revision?: number; deleted?: boolean }>());
  const busyRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;
  const acceptCurrentProject = useCallback((next: Project) => {
    // Resolve against the latest React state, including project switches queued in this same turn.
    setProject((current) => reconcileProjectRefresh(current, next));
  }, []);
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
    if (previewTimer.current || previewRunning.current || !pendingPreview.current) return;
    previewTimer.current = setTimeout(() => {
      void (async () => {
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
      })();
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
  async function importImage(kind: "image" | "audio" = "image") {
    if (!project) return;
    const path = await pickPath(kind);
    if (!path) return;
    const next = await command<Project>("asset.import", {
      kind,
      projectId: project.id,
      path,
      expectedRevision: project.revision,
    });
    acceptCurrentProject(next);
    if (projectRef.current?.id !== next.id) return;
    return { asset: next.assets.at(-1), revision: next.revision };
  }
  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T | undefined> => {
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
  }, []);
  const refreshProjects = useCallback(async () => {
    setProjects(await command<ProjectSummary[]>("project.list"));
  }, []);
  async function insertMedia(kind: "video" | "image") {
    cancelDraftPreview();
    await run(async () => {
      const current = projectRef.current;
      if (!current?.source) return;
      const atMs = playback.getSnapshot().timeMs;
      const path = await pickPath(kind);
      if (!path || projectRef.current?.id !== current.id) return;
      if (projectRef.current.revision !== current.revision)
        throw new Error("The project changed while choosing media. Please insert it again.");
      const imported = await command<Project>("asset.import", {
        kind,
        projectId: current.id,
        path,
        expectedRevision: current.revision,
      });
      acceptCurrentProject(imported);
      if (projectRef.current?.id !== current.id) return;
      const asset = imported.assets.find(
        (item) => !current.assets.some((old) => old.id === item.id),
      );
      if (!asset) throw new Error("The imported media could not be found.");
      const next = await command<Project>("timeline.apply", {
        projectId: current.id,
        expectedRevision: imported.revision,
        operations: [{ type: "clip.insert", assetId: asset.id, atMs }],
      });
      if (projectRef.current?.id !== current.id) return;
      acceptCurrentProject(next);
      const inserted = next.edits.segments.find((segment) => segment.assetId === asset.id);
      if (inserted) setSelection({ startMs: atMs, endMs: atMs + segmentDuration(inserted) });
      playback.setDuration(duration(next.edits.segments));
      await playback.seek(atMs);
      await refreshProjects();
    });
  }
  const {
    settings,
    models,
    chats,
    setChats,
    refreshSettings,
    saveSettings,
    saveKey,
    exportTranscript,
  } = useAssistantController({ project, run, setNotice });
  const {
    recording,
    setRecording,
    recordingBusy,
    recordingBusyRef,
    startRecording,
    toggleCameraVisibility,
    toggleCameraDevice,
    toggleRecordingPause,
    finishRecording,
  } = useRecordingController({
    project,
    projectRef,
    setModal,
    setError,
    setNotice,
    acceptCurrentProject,
    refreshProjects,
  });
  const {
    activeJobs,
    startJob,
    cancelJob,
    exportPath,
    setExportPath,
    silenceReview,
    setSilenceReview,
  } = useJobsController({
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
  });
  const {
    actionProject,
    saveDraft,
    openProject,
    backToLibrary,
    importProject,
    importVideo,
    startRecordingProject,
    renameProject,
    deleteProject,
    createProject,
    commitRename,
    confirmDelete,
  } = useProjectController({
    project,
    recording,
    run,
    setProject,
    setModal,
    setNotice,
    acceptCurrentProject,
    refreshProjects,
    cancelDraftPreview,
  });
  const { openExport, exportVideo } = useExportController({
    project,
    exportPath,
    startJob,
    setModal,
    setError,
  });
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
    const failure = results.find((r, index) => r.status === "rejected" && (desktop || index !== 1));
    if (failure?.status === "rejected") setError(messageOf(failure.reason));
    setLoading(false);
  }, [refreshProjects, refreshSettings, setRecording]);
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
    const shortcut = listen<{ message: string }>("shortcut-error", ({ payload }) =>
      setError(payload.message),
    );
    let refreshing = false;
    const timer = setInterval(() => {
      void (async () => {
        if (busyRef.current || refreshing || !pendingProjectChanges.current.size) return;
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
      })();
    }, 400);
    return () => {
      clearInterval(timer);
      void changed.then((unlisten) => unlisten());
      void blocked.then((unlisten) => unlisten());
      void shortcut.then((unlisten) => unlisten());
    };
  }, [refreshProjects]);
  useEffect(() => {
    if (!project?.source || modal || !desktop) return;
    let cancelled = false;
    const id = setInterval(() => {
      if (!cancelled) void playback.poll();
    }, 100);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [project?.id, project?.source, modal, playback]);
  useEffect(() => {
    playback.reset(projectRef.current ? duration(projectRef.current.edits.segments) : 0);
    setSelection({ startMs: 0, endMs: 0 });
    setSilenceReview(null);
    setSelectedZoom(null);
    setCameraScope("selection");
  }, [project?.id, playback, setSilenceReview, setSelection]);
  useEffect(() => {
    playback.setDuration(total);
    updateSelection((s) => ({
      startMs: Math.min(s.startMs, total),
      endMs: Math.min(s.endMs, total),
    }));
  }, [total, playback]);
  async function apply(operations: EditOperation[], revision = project?.revision) {
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
          await command("preview.load", { projectId: project.id }).catch(() => {});
        throw error;
      }
      if (projectRef.current?.id !== next.id) return;
      const nextTarget = targetAfterEdit(editorTargetRef.current, project, next, operations);
      if (editorTargetRef.current && !nextTarget) updateSelection({ startMs: 0, endMs: 0 });
      setEditorTarget(nextTarget);
      acceptCurrentProject(next);
      const zoom = next.edits.zooms.find(
        (item) => !project.edits.zooms.some((old) => old.id === item.id),
      );
      const overlay = next.edits.overlays.find(
        (item) => !project.edits.overlays.some((old) => old.id === item.id),
      );
      if (zoom && operations.some((op) => op.type === "zoom.add")) {
        selectEditorTarget({ kind: "zoom", id: zoom.id }, next);
        const ranges = outputRanges(next.edits.segments, zoom);
        if (ranges[0]) await playback.seek((ranges[0].startMs + ranges[0].endMs) / 2);
      }
      if (overlay && operations.some((op) => op.type === "overlay.add")) {
        selectEditorTarget({ kind: "overlay", id: overlay.id }, next);
        setSelectedZoom(null);
        const ranges = outputRanges(next.edits.segments, overlay);
        if (ranges[0]) await playback.seek((ranges[0].startMs + ranges[0].endMs) / 2);
      }
      const moved = operations.find((op) => op.type === "clip.move");
      if (moved?.type === "clip.move") {
        const clip = next.edits.segments[moved.toIndex];
        if (clip) {
          const startMs = duration(next.edits.segments.slice(0, moved.toIndex));
          updateSelection({ startMs, endMs: startMs + segmentDuration(clip) });
          await playback.seek(startMs);
        }
      }
      void refreshProjects();
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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { timeMs } = playback.getSnapshot();
      if (e.defaultPrevented) return;
      const input = (e.target as HTMLElement).closest(
        'input, textarea, select, [contenteditable="true"]',
      );
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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
      if (
        e.code === "Space" &&
        project?.source &&
        !(e.target instanceof HTMLElement && e.target.closest("button, summary, a, [role=button]"))
      ) {
        e.preventDefault();
        void togglePlayback();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const projectBusy =
    busy ||
    (recording.active && recording.projectId === project?.id) ||
    activeJobs.some((j) => j.projectId === project?.id);
  const filtered = projects
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : new Date(sort === "created" ? b.createdAt : b.updatedAt).getTime() -
          new Date(sort === "created" ? a.createdAt : a.updatedAt).getTime(),
    );
  const projectLocked = (id: string) =>
    (recording.active && recording.projectId === id) || activeJobs.some((j) => j.projectId === id);
  function refreshCapabilities() {
    return run(async () => setCapabilities(await command<AppCapabilities>("app.capabilities")));
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
    importVideo,
    startRecordingProject,
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
    inspectorRef,
    playback,
    cameraScope,
    setCameraScope,
    recordingBusy,
    selection,
    setSelection,
    editorTarget,
    selectEditorTarget,
    chats,
    setChats,
    silenceReview,
    setSilenceReview,
    total,
    importImage: useStableCallback(() => importImage()),
    importAudio: useStableCallback(() => importImage("audio")),
    insertMedia: useStableCallback(insertMedia),
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
