import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Camera,
  Check,
  ChevronDown,
  Circle,
  Clapperboard,
  Download,
  Eye,
  EyeOff,
  FileVideo,
  Folder,
  FolderOpen,
  ImagePlus,
  Keyboard,
  Layers,
  LoaderCircle,
  Maximize2,
  Mic,
  Monitor,
  MoreHorizontal,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Subtitles,
  Trash2,
  Type,
  Undo2,
  Video,
  WandSparkles,
  X,
  ZoomIn,
} from "lucide-react";
import type {
  AppCapabilities,
  CaptureSettings,
  EditOperation,
  Job,
  Overlay,
  Project,
  ProjectSummary,
  Range,
  RecordingStatus,
  TranscriptSegment,
  CanvasSettings,
  Zoom,
} from "../shared/types";
import { defaultCanvas, defaultAutoZoom } from "../shared/types";
import {
  duration,
  formatTime,
  outputRanges,
  outputSize,
  segmentDuration,
} from "../shared/timeline";
import { command, desktop, messageOf, pickPath } from "./api";

type Modal =
  | "new"
  | "record"
  | "settings"
  | "export"
  | "rename"
  | "delete"
  | null;
type Tab =
  | "general"
  | "camera"
  | "zoom"
  | "overlays"
  | "audio"
  | "transcript"
  | "ai";
type Settings = {
  provider: "openai" | "anthropic";
  openaiModel: string;
  anthropicModel: string;
  transcriptionModel: "small" | "base";
  language: string;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
};
type McpConfig = { command: string; args: string[]; bundleId?: string };
type Model = {
  id: "base" | "small";
  name: string;
  bytes: number;
  installed: boolean;
};
const ErrorContext = createContext("");
const DraftPreviewContext = createContext<{
  send: (operations: EditOperation[] | null) => void;
  scope: string;
}>({ send: () => {}, scope: "" });
const idleRecording: RecordingStatus = {
  active: false,
  paused: false,
  durationMs: 0,
  microphoneLevel: 0,
  systemLevel: 0,
  cameraVisible: true,
  cameraEnabled: true,
};
const tabItems = [
  { id: "general", icon: SlidersHorizontal, title: "General" },
  { id: "camera", icon: Camera, title: "Camera" },
  { id: "zoom", icon: MousePointer2, title: "Zoom & cursor" },
  { id: "overlays", icon: Layers, title: "Overlays" },
  { id: "audio", icon: AudioLines, title: "Audio" },
  { id: "transcript", icon: Subtitles, title: "Transcript" },
  { id: "ai", icon: Sparkles, title: "AI assistant" },
] as const;
const number = (value: string) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const seconds = (ms: number) => (ms / 1000).toFixed(2);
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

function IconButton({
  children,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      className={`icon-button ${props.className ?? ""}`}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Switch({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}
function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  suffix = "%",
  onPreview,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
  onPreview?: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const draftValue = useRef(value);
  const lastCommit = useRef(value);
  const gesture = useRef<{ scope: string; cancelled: boolean } | null>(null);
  const pointer = useRef<{ target: HTMLInputElement; id: number } | null>(null);
  const { send: cancelPreview, scope } = useContext(DraftPreviewContext);
  const error = useContext(ErrorContext);
  function releasePointer() {
    const captured = pointer.current;
    pointer.current = null;
    if (captured?.target.hasPointerCapture(captured.id))
      captured.target.releasePointerCapture(captured.id);
  }
  function resetValue() {
    setDraft(value);
    draftValue.current = value;
    lastCommit.current = value;
  }
  function cancelGesture() {
    if (gesture.current) gesture.current.cancelled = true;
    releasePointer();
    resetValue();
    cancelPreview(null);
  }
  useEffect(() => {
    if (gesture.current && gesture.current.scope !== scope) cancelGesture();
    else resetValue();
  }, [scope, value]);
  useEffect(() => {
    if (error) cancelGesture();
  }, [error]);
  useEffect(
    () => () => {
      if (gesture.current) cancelPreview(null);
      releasePointer();
    },
    [],
  );
  const commit = () => {
    const active = gesture.current;
    gesture.current = null;
    releasePointer();
    if (active && (active.cancelled || active.scope !== scope)) {
      resetValue();
      cancelPreview(null);
      return;
    }
    if (draftValue.current !== lastCommit.current) {
      lastCommit.current = draftValue.current;
      onChange(draftValue.current);
    } else if (active) cancelPreview(null);
  };
  return (
    <label className="slider-field">
      <span>
        {label}
        <b>
          {suffix === "%" ? Math.round(draft * 100) : draft.toFixed(1)}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          releasePointer();
          gesture.current = { scope, cancelled: false };
          pointer.current = { target: e.currentTarget, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onKeyDown={(e) => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
              "PageUp",
              "PageDown",
            ].includes(e.key) &&
            (!gesture.current || gesture.current.cancelled)
          )
            gesture.current = { scope, cancelled: false };
        }}
        onChange={(e) => {
          if (
            gesture.current &&
            (gesture.current.cancelled || gesture.current.scope !== scope)
          ) {
            resetValue();
            return;
          }
          gesture.current ??= { scope, cancelled: false };
          const next = Number(e.target.value);
          draftValue.current = next;
          setDraft(next);
          onPreview?.(next);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        onPointerCancel={cancelGesture}
      />
    </label>
  );
}
function Dialog({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const error = useContext(ErrorContext);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`dialog ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <IconButton label="Close dialog" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      {error && (
        <p role="alert" className="inline-error dialog-error">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}

export default function App() {
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
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
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
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPreview = useRef<{
    projectId: string;
    revision: number;
    operations: EditOperation[];
  } | null>(null);
  const previewRunning = useRef(false);
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
        await command("preview.draft", {
          projectId: pending.projectId,
          expectedRevision: pending.revision,
          operations: pending.operations,
        });
      } catch {
        /* A stale preview is superseded by the next committed edit. */
      } finally {
        previewRunning.current = false;
        scheduleDraftPreview();
      }
    }, 150);
  }
  function draftPreview(operations: EditOperation[] | null) {
    const current = projectRef.current;
    if (!desktop || !capabilities?.nativeAvailable || !current?.source) return;
    if (operations === null) {
      cancelDraftPreview();
      void command("preview.load", { projectId: current.id }).catch(() => {});
      return;
    }
    pendingPreview.current = {
      projectId: current.id,
      revision: current.revision,
      operations,
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
    setProject(next);
    return { asset: next.assets.at(-1), revision: next.revision };
  }

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
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
        setJobs(nextJobs);
        setRecording(nextRecording);
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
            setProject(
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
    const id = setInterval(async () => {
      try {
        const state = await command<{ timeMs: number; playing: boolean }>(
          "preview.status",
        );
        if (!cancelled && state) {
          if (typeof state.timeMs === "number") setTimeMs(state.timeMs);
          setPlaying(Boolean(state.playing));
        }
      } catch {
        /* Preview initialization reports the actionable error. */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [project?.id, project?.source, modal]);
  useEffect(() => {
    setTimeMs(0);
    setPlaying(false);
    setSelection({ startMs: 0, endMs: 0 });
    setSilenceReview(null);
    setSelectedZoom(null);
  }, [project?.id]);
  useEffect(() => {
    setTimeMs((t) => Math.min(t, total));
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
      setProject(next);
      await refreshProjects();
    });
  }
  async function saveDraft() {
    if (!project) return;
    await run(async () => {
      setProject(
        await command<Project>("project.save", { projectId: project.id }),
      );
      setNotice("Draft saved");
      await refreshProjects();
    });
  }
  async function openProject(id: string) {
    cancelDraftPreview();
    await run(async () => {
      if (project) await command("project.save", { projectId: project.id });
      setProject(await command<Project>("project.open", { projectId: id }));
    });
  }
  async function backToLibrary() {
    cancelDraftPreview();
    await run(async () => {
      if (project) await command("project.save", { projectId: project.id });
      await command("preview.pause").catch(() => {});
      setProject(null);
      await refreshProjects();
    });
  }
  async function history(action: "undo" | "redo") {
    cancelDraftPreview();
    if (!project) return;
    await run(async () => {
      setProject(
        await command<Project>(`history.${action}`, {
          projectId: project.id,
          expectedRevision: project.revision,
        }),
      );
    });
  }
  async function seek(value: number) {
    const clamped = Math.max(0, Math.min(value, total));
    setTimeMs(clamped);
    try {
      if (desktop) await command("preview.seek", { timeMs: clamped });
    } catch (e) {
      setError(messageOf(e));
    }
  }
  async function togglePlayback() {
    if (!project?.source) return;
    try {
      await command(`preview.${playing ? "pause" : "play"}`);
      setPlaying(!playing);
    } catch (e) {
      setError(messageOf(e));
    }
  }
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
        !recording.active &&
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
    busy || activeJobs.some((j) => j.projectId === project?.id);
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

  return (
    <ErrorContext.Provider value={error}>
      <DraftPreviewContext.Provider
        value={{
          send: draftPreview,
          scope: `${project?.id ?? ""}:${project?.revision ?? ""}`,
        }}
      >
        <div
          className={`app ${project ? "editing" : "library"} ${desktop ? "desktop" : ""}`}
        >
          <header className="app-header" data-tauri-drag-region>
            <button
              className="brand"
              onClick={() => project && void backToLibrary()}
              aria-label="Screen Recorder projects"
            >
              <span className="brand-mark">
                <Video size={20} strokeWidth={2.5} />
              </span>
              <span>
                Screen Recorder<span className="brand-dot">.</span>
              </span>
            </button>
            {project ? (
              <div className="project-heading">
                <span className="header-divider" />
                <button
                  className="project-title"
                  onClick={() => void renameProject(project)}
                >
                  {project.name}
                  <ChevronDown size={13} />
                </button>
                <span className="save-indicator">
                  {busy ? (
                    <LoaderCircle className="spin" size={12} />
                  ) : (
                    <Check size={12} />
                  )}
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
                <>
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
                  <button
                    className="button subtle save-button"
                    disabled={busy}
                    onClick={() => void saveDraft()}
                  >
                    <Save size={15} />
                    Save Draft
                  </button>
                </>
              )}
              <IconButton label="Settings" onClick={() => setModal("settings")}>
                <Settings2 />
              </IconButton>
              {project && (
                <button
                  className="button primary"
                  disabled={!project.source || projectBusy || recording.active}
                  onClick={() => setModal("export")}
                >
                  <ArrowDownToLine size={15} />
                  Export video
                </button>
              )}
            </div>
          </header>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {!connected && (
                <button onClick={() => void initialize()}>Reconnect</button>
              )}
              <IconButton label="Dismiss error" onClick={() => setError("")}>
                <X size={14} />
              </IconButton>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}

          {!project ? (
            <div className="library-layout">
              <aside className="library-sidebar">
                <div className="workspace-label">YOUR WORKSPACE</div>
                <button className="sidebar-link selected">
                  <Folder size={17} />
                  All projects<span>{projects.length}</span>
                </button>
                <div className="sidebar-bottom">
                  <div className="privacy-card">
                    <ShieldCheck size={22} />
                    <strong>Made to stay yours.</strong>
                    <p>Your recordings and projects live on your Mac.</p>
                    <span>Local projects. No limits.</span>
                  </div>
                  <button
                    className="sidebar-link"
                    onClick={() => setModal("settings")}
                  >
                    <Keyboard size={17} />
                    Settings & MCP
                  </button>
                  <div className="app-version">
                    SCREEN RECORDER <span>OPEN SOURCE</span>
                  </div>
                </div>
              </aside>
              <main className="library-main">
                <div className="library-title-row">
                  <div>
                    <div className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</div>
                    <h1>
                      Your projects<span className="accent-dot">.</span>
                    </h1>
                    <p>Record something worth sharing. Make it your own.</p>
                  </div>
                  <button
                    className="button primary large"
                    disabled={busy || !connected}
                    onClick={() => setModal("new")}
                  >
                    <Plus size={18} />
                    New project
                  </button>
                </div>
                <div className="library-toolbar">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      placeholder="Search your projects…"
                      aria-label="Search projects"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <kbd>⌕</kbd>
                  </div>
                  <div className="library-toolbar-actions">
                    <button
                      className="button subtle"
                      disabled={busy || !connected}
                      onClick={() => void importProject()}
                    >
                      <FolderOpen size={15} />
                      Open folder
                    </button>
                    <label className="sort-control">
                      <SlidersHorizontal size={14} />
                      <select
                        aria-label="Sort projects"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="modified">Last edited</option>
                        <option value="created">Date created</option>
                        <option value="name">Name</option>
                      </select>
                    </label>
                  </div>
                </div>
                {loading ? (
                  <div className="empty-state">
                    <LoaderCircle size={30} className="spin" />
                    <h2>Opening your workspace</h2>
                  </div>
                ) : !connected ? (
                  <div className="empty-state">
                    <Monitor size={36} />
                    <h2>Let’s connect your workspace</h2>
                    <p>
                      The local recording service is unavailable. Start the
                      desktop app or development service, then reconnect.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => void initialize()}
                    >
                      <RefreshCw size={15} />
                      Reconnect
                    </button>
                  </div>
                ) : filtered.length ? (
                  <>
                    <div className="section-label">
                      {search
                        ? `${filtered.length} matching projects`
                        : "ALL PROJECTS"}
                      <span>
                        {filtered.length}{" "}
                        {filtered.length === 1 ? "project" : "projects"}
                      </span>
                    </div>
                    <div className="project-grid">
                      {filtered.map((p, index) => (
                        <article className="project-card" key={p.id}>
                          <button
                            className={`project-cover cover-${index % 4}`}
                            onClick={() => void openProject(p.id)}
                            disabled={busy}
                            aria-label={`Open ${p.name}`}
                          >
                            {p.thumbnail ? (
                              <ProjectThumbnail thumbnail={p.thumbnail} />
                            ) : (
                              <div className="cover-art">
                                <div className="cover-window">
                                  <span />
                                  <span />
                                  <span />
                                  <div>
                                    <FileVideo size={31} strokeWidth={1.1} />
                                  </div>
                                </div>
                                <div className="cover-orb" />
                              </div>
                            )}
                            <span className={`status-tag ${p.status}`}>
                              <span />
                              {p.status === "draft"
                                ? "Draft"
                                : p.status === "recording"
                                  ? "Recording"
                                  : "Ready to edit"}
                            </span>
                            {p.durationMs > 0 && (
                              <span className="duration-tag">
                                {formatTime(p.durationMs)}
                              </span>
                            )}
                          </button>
                          <div className="project-card-body">
                            <button
                              className="project-card-title"
                              onClick={() => void openProject(p.id)}
                            >
                              {p.name}
                            </button>
                            <details className="project-menu">
                              <summary aria-label={`Actions for ${p.name}`}>
                                <MoreHorizontal size={18} />
                              </summary>
                              <div>
                                <button
                                  aria-label={`Rename ${p.name}`}
                                  onClick={() => void renameProject(p)}
                                >
                                  Rename
                                </button>
                                <button
                                  aria-label={`Move ${p.name} to Trash`}
                                  className="danger-text"
                                  disabled={busy || projectLocked(p.id)}
                                  onClick={() => void deleteProject(p)}
                                >
                                  Move to Trash
                                </button>
                              </div>
                            </details>
                            <p>
                              Edited {date(p.updatedAt)}
                              <span>
                                {p.durationMs > 0
                                  ? "Recording project"
                                  : "No recording yet"}
                              </span>
                            </p>
                          </div>
                        </article>
                      ))}
                      <button
                        className="new-project-card"
                        onClick={() => setModal("new")}
                      >
                        <span>
                          <Plus size={24} />
                        </span>
                        <strong>Start a new story</strong>
                        <p>Your next idea belongs here.</p>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-illustration">
                      <div className="empty-frame">
                        <Monitor size={48} strokeWidth={1.2} />
                        <span>
                          <Camera size={20} />
                        </span>
                      </div>
                      <span className="empty-spark">
                        <Sparkles size={18} />
                      </span>
                    </div>
                    <span className="eyebrow">
                      FROM FIRST TAKE TO FINAL CUT
                    </span>
                    <h2>
                      {search
                        ? "No projects found"
                        : "Your next great video starts here"}
                    </h2>
                    <p>
                      {search
                        ? "Try another project name."
                        : "Capture your screen and camera, polish the details, and turn your know-how into something shareable."}
                    </p>
                    {!search && (
                      <button
                        className="button primary large"
                        onClick={() => setModal("new")}
                      >
                        <Plus size={17} />
                        Create your first project
                        <ArrowRight size={16} />
                      </button>
                    )}
                    <div className="empty-features">
                      <span>
                        <Monitor size={14} />
                        Screen + camera
                      </span>
                      <span>
                        <WandSparkles size={14} />
                        AI editing
                      </span>
                      <span>
                        <ShieldCheck size={14} />
                        Local by default
                      </span>
                    </div>
                  </div>
                )}
                <footer className="library-footer">
                  <span>
                    <span
                      className={`connection-dot ${connected ? "online" : ""}`}
                    />
                    {connected
                      ? "Everything saved on your device"
                      : "Waiting for local service"}
                  </span>
                  <span>Good ideas deserve good videos.</span>
                </footer>
              </main>
            </div>
          ) : (
            <>
              <div className="editor-layout">
                <nav className="tool-rail">
                  <IconButton
                    label="Back to projects"
                    onClick={() => void backToLibrary()}
                  >
                    <ArrowLeft />
                  </IconButton>
                  <div className="rail-divider" />
                  {tabItems.map((item) => (
                    <button
                      key={item.id}
                      className={`rail-tool ${tab === item.id ? "active" : ""}`}
                      aria-label={item.title}
                      aria-pressed={tab === item.id}
                      title={item.title}
                      onClick={() => setTab(item.id)}
                    >
                      <item.icon size={19} />
                      <span>
                        {item.id === "transcript"
                          ? "Captions"
                          : item.id === "overlays"
                            ? "Layers"
                            : item.id === "ai"
                              ? "AI"
                              : item.id === "zoom"
                                ? "Zoom"
                                : item.title}
                      </span>
                    </button>
                  ))}
                </nav>
                <main className="editor-main">
                  <div className="preview-toolbar">
                    <span>
                      <Clapperboard size={14} />
                      {project.source ? "Preview" : "Recording studio"}
                    </span>
                    <div>
                      {project.source && (
                        <span className="resolution-tag">
                          {project.source.width} × {project.source.height}
                          <span>•</span>
                          {project.source.fps} fps
                        </span>
                      )}
                      <span className="preview-fit">Fit</span>
                    </div>
                  </div>
                  {project.source ? (
                    <NativePreview
                      project={project}
                      hidden={Boolean(modal)}
                      onError={setError}
                    />
                  ) : (
                    <div className="record-empty">
                      <span className="record-empty-icon">
                        <Video size={33} strokeWidth={1.3} />
                      </span>
                      <div className="eyebrow">THE FLOOR IS YOURS</div>
                      <h2>Ready when you are.</h2>
                      <p>
                        Pick your screen, turn on your camera,
                        <br />
                        and bring your idea to life.
                      </p>
                      <button
                        className="button primary large"
                        disabled={busy || recording.active}
                        onClick={() => setModal("record")}
                      >
                        <Circle size={16} fill="currentColor" />
                        Set up recording
                      </button>
                      <span className="record-empty-note">
                        <Mic size={12} />
                        Separate screen, camera & audio tracks
                      </span>
                    </div>
                  )}
                  <div className="playback-toolbar">
                    <span className="playback-time">
                      {formatTime(timeMs)}
                      <span>/ {formatTime(total)}</span>
                    </span>
                    <div>
                      <IconButton
                        label="Go to start"
                        disabled={!project.source}
                        onClick={() => void seek(0)}
                      >
                        <ArrowLeft size={16} />
                      </IconButton>
                      <button
                        className="play-button"
                        disabled={!project.source || recording.active}
                        aria-label={playing ? "Pause preview" : "Play preview"}
                        onClick={() => void togglePlayback()}
                      >
                        {playing ? (
                          <Pause size={18} fill="currentColor" />
                        ) : (
                          <Play size={18} fill="currentColor" />
                        )}
                      </button>
                      <IconButton
                        label="Go to end"
                        disabled={!project.source}
                        onClick={() => void seek(total)}
                      >
                        <ArrowRight size={16} />
                      </IconButton>
                    </div>
                    <span className="playback-shortcut">
                      <kbd>space</kbd> to play
                    </span>
                  </div>
                </main>
                <aside className="inspector">
                  <div className="inspector-title">
                    <span>{tabItems.find((i) => i.id === tab)?.title}</span>
                    {tab === "ai" && <span className="mini-tag">BYOK</span>}
                  </div>
                  <div className="inspector-body" ref={inspectorRef}>
                    <fieldset
                      disabled={projectBusy || recording.active}
                      className="unstyled-fieldset"
                    >
                      {tab === "general" && (
                        <CanvasPanel
                          project={project}
                          apply={apply}
                          importImage={importImage}
                          onError={setError}
                        />
                      )}
                      {tab === "camera" && (
                        <CameraPanel
                          project={project}
                          selection={selection}
                          apply={apply}
                        />
                      )}
                      {tab === "zoom" && (
                        <ZoomPanel
                          project={project}
                          selection={selection}
                          apply={apply}
                          selectedId={selectedZoom}
                          onSelect={setSelectedZoom}
                        />
                      )}
                      {tab === "overlays" && (
                        <OverlaysPanel
                          project={project}
                          selection={selection}
                          apply={apply}
                          importImage={async () => {
                            const path = await pickPath("image");
                            if (!path) return;
                            const next = await command<Project>(
                              "asset.import",
                              {
                                projectId: project.id,
                                path,
                                expectedRevision: project.revision,
                              },
                            );
                            setProject(next);
                            return {
                              asset: next.assets.at(-1),
                              revision: next.revision,
                            };
                          }}
                          onError={setError}
                        />
                      )}
                      {tab === "audio" && (
                        <>
                          <PanelIntro
                            title="A little clarity goes a long way."
                            text="Balance your voice and the sounds on your screen."
                          />
                          <h3 className="panel-section">MIXER</h3>
                          <Slider
                            label="Microphone"
                            value={project.edits.audio.microphoneVolume}
                            max={2}
                            onChange={(v) =>
                              void apply([
                                {
                                  type: "audio.update",
                                  settings: { microphoneVolume: v },
                                },
                              ])
                            }
                          />
                          <Slider
                            label="System audio"
                            value={project.edits.audio.systemVolume}
                            max={2}
                            onChange={(v) =>
                              void apply([
                                {
                                  type: "audio.update",
                                  settings: { systemVolume: v },
                                },
                              ])
                            }
                          />
                          <div className="panel-divider" />
                          <h3 className="panel-section">SMART CLEANUP</h3>
                          <p className="helper">
                            Find pauses using the recorded audio. Review every
                            suggested cut before applying it.
                          </p>
                          <SilenceControls
                            disabled={!project.source}
                            onAnalyze={(params) =>
                              void startJob("ai.cleanSilence", {
                                ...params,
                                apply: false,
                                expectedRevision: project.revision,
                              })
                            }
                          />
                          {silenceReview && (
                            <div className="review-card">
                              <strong>
                                {silenceReview.ranges.length
                                  ? `${silenceReview.ranges.length} pauses found`
                                  : "No pauses found"}
                              </strong>
                              <p>
                                {formatTime(silenceReview.removedMs)} can be
                                removed.
                              </p>
                              <div className="review-ranges">
                                {silenceReview.ranges.map((r, i) => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      setSelection(r);
                                      void seek(r.startMs);
                                    }}
                                  >
                                    {seconds(r.startMs)}s – {seconds(r.endMs)}s
                                  </button>
                                ))}
                              </div>
                              {silenceReview.ranges.length > 0 && (
                                <button
                                  className="button primary full"
                                  onClick={async () => {
                                    await apply(
                                      silenceReview.operations,
                                      silenceReview.revision,
                                    );
                                    setSilenceReview(null);
                                  }}
                                >
                                  <Scissors size={14} />
                                  Apply cuts
                                </button>
                              )}
                              <button
                                className="button subtle full"
                                onClick={() => setSilenceReview(null)}
                              >
                                Dismiss
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      {tab === "transcript" && (
                        <TranscriptPanel
                          project={project}
                          settings={settings}
                          apply={apply}
                          onJob={startJob}
                          onSelect={(range) => {
                            setSelection(range);
                            void seek(range.startMs);
                          }}
                          onError={setError}
                        />
                      )}
                    </fieldset>
                    {tab === "ai" && (
                      <AssistantPanel
                        messages={chats[project.id] || []}
                        settings={settings}
                        disabled={projectBusy || !project.source}
                        onSettings={() => setModal("settings")}
                        onSend={async (prompt) => {
                          setChats((c) => ({
                            ...c,
                            [project.id]: [
                              ...(c[project.id] || []),
                              { role: "user", text: prompt },
                            ],
                          }));
                          await startJob("ai.assistant", {
                            prompt,
                            provider: settings?.provider,
                          });
                        }}
                      />
                    )}
                  </div>
                </aside>
              </div>
              <Timeline
                project={project}
                total={total}
                timeMs={timeMs}
                selection={selection}
                setSelection={setSelection}
                seek={seek}
                apply={apply}
                disabled={projectBusy || recording.active}
                selectedZoom={selectedZoom}
                onSelectZoom={(id) => {
                  setSelectedZoom(id);
                  setTab("zoom");
                }}
              />
              <div className="editor-status">
                <span>
                  <span className="connection-dot online" />
                  Local project<span className="status-separator">/</span>
                  {project.source
                    ? `${project.edits.segments.length} clip${project.edits.segments.length === 1 ? "" : "s"}`
                    : "Draft"}
                  {project.recovered && (
                    <span className="recovered">
                      Recovered after an interruption
                    </span>
                  )}
                </span>
                <span>
                  <kbd>⌘ S</kbd> Save<span className="status-separator">·</span>
                  <kbd>⌘ Z</kbd> Undo
                </span>
              </div>
            </>
          )}

          {recording.active && (
            <div className="recording-hud" role="status">
              <div
                className={`record-dot ${recording.paused ? "paused" : ""}`}
              />
              <div className="recording-clock">
                {formatTime(recording.durationMs)}
                <small>{recording.paused ? "Paused" : "Recording"}</small>
              </div>
              <div className="audio-meter" title="Microphone level">
                <Mic size={14} />
                <meter
                  min={0}
                  max={1}
                  value={recording.microphoneLevel}
                  aria-label="Microphone level"
                />
              </div>
              <IconButton
                label={recording.cameraVisible ? "Hide camera" : "Show camera"}
                onClick={() =>
                  void run(async () =>
                    setRecording(
                      await command("recording.camera", {
                        visible: !recording.cameraVisible,
                      }),
                    ),
                  )
                }
              >
                {recording.cameraVisible ? <Camera /> : <EyeOff />}
              </IconButton>
              <IconButton
                label={
                  recording.cameraEnabled
                    ? "Turn camera device off (this interval cannot be restored)"
                    : "Turn camera device on"
                }
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    setRecording(
                      await command("recording.camera", {
                        enabled: !recording.cameraEnabled,
                      }),
                    ),
                  )
                }
              >
                <Video className={recording.cameraEnabled ? "" : "muted"} />
              </IconButton>
              <IconButton
                label={
                  recording.paused ? "Resume recording" : "Pause recording"
                }
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    setRecording(
                      await command(
                        `recording.${recording.paused ? "resume" : "pause"}`,
                        { projectId: recording.projectId },
                      ),
                    ),
                  )
                }
              >
                {recording.paused ? <Play /> : <Pause />}
              </IconButton>
              <button
                className="button recording-stop"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const next = await command<Project>("recording.stop", {
                      projectId: recording.projectId,
                    });
                    setProject(next);
                    setRecording(idleRecording);
                    await refreshProjects();
                    setNotice("Recording saved. Make it your own.");
                  })
                }
              >
                <Square size={12} fill="currentColor" />
                Finish
              </button>
            </div>
          )}
          {exportPath && !activeJobs.some((j) => j.kind === "export") && (
            <div className="export-complete" role="status">
              <Check size={17} />
              <div>
                <strong>Your video is ready</strong>
                <p>{exportPath.split("/").pop()}</p>
              </div>
              {desktop && (
                <button
                  className="button secondary"
                  onClick={() =>
                    void openPath(exportPath).catch((e) =>
                      setError(messageOf(e)),
                    )
                  }
                >
                  Open video
                </button>
              )}
              <IconButton
                label="Dismiss export result"
                onClick={() => setExportPath("")}
              >
                <X size={13} />
              </IconButton>
            </div>
          )}
          {activeJobs.length > 0 && (
            <div className="jobs-stack" aria-live="polite">
              {activeJobs.map((job) => (
                <div className="job-card" key={job.id}>
                  <div>
                    <LoaderCircle className="spin" size={15} />
                    <strong>
                      {job.kind === "model"
                        ? "Downloading AI model"
                        : job.kind === "export"
                          ? "Exporting video"
                          : job.kind === "transcribe"
                            ? "Transcribing locally"
                            : job.kind === "silence"
                              ? "Finding quiet moments"
                              : "Assistant is working"}
                    </strong>
                    <IconButton
                      label="Cancel job"
                      onClick={() =>
                        void run(async () => {
                          await command("jobs.cancel", { jobId: job.id });
                        })
                      }
                    >
                      <X size={13} />
                    </IconButton>
                  </div>
                  <progress
                    max={1}
                    value={job.progress > 1 ? job.progress / 100 : job.progress}
                  />
                  <p>{job.message}</p>
                </div>
              ))}
            </div>
          )}

          {modal === "new" && (
            <Dialog
              title="A fresh canvas."
              subtitle="Give your next video a place to begin."
              onClose={() => !busy && setModal(null)}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = String(
                    new FormData(e.currentTarget).get("name") || "",
                  ).trim();
                  if (!name) return;
                  void run(async () => {
                    const created = await command<Project>("project.create", {
                      name,
                    });
                    setProject(created);
                    setModal(null);
                    await refreshProjects();
                  });
                }}
              >
                <Field label="Project name">
                  <input
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
                  <button
                    type="button"
                    className="button subtle"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={busy}>
                    {busy ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Plus size={15} />
                    )}
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = String(
                    new FormData(e.currentTarget).get("name") || "",
                  ).trim();
                  if (!name) return;
                  void run(async () => {
                    const next = await command<Project>("project.rename", {
                      projectId: actionProject.id,
                      name,
                      expectedRevision: actionProject.revision,
                    });
                    if (project?.id === next.id) setProject(next);
                    await refreshProjects();
                    setModal(null);
                  });
                }}
              >
                <Field label="Project name">
                  <input
                    autoFocus
                    name="name"
                    defaultValue={actionProject.name}
                    required
                    maxLength={200}
                  />
                </Field>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="button subtle"
                    onClick={() => setModal(null)}
                  >
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
                <span>
                  You can restore the folder from the Trash and open it again.
                </span>
              </div>
              <div className="dialog-actions">
                <button
                  className="button subtle"
                  onClick={() => setModal(null)}
                >
                  Keep project
                </button>
                <button
                  className="button danger-button"
                  disabled={busy || projectLocked(actionProject.id)}
                  onClick={() =>
                    void run(async () => {
                      await command("project.delete", {
                        projectId: actionProject.id,
                      });
                      if (project?.id === actionProject.id) setProject(null);
                      await refreshProjects();
                      setModal(null);
                      setNotice("Project moved to Trash");
                    })
                  }
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
              onRefresh={() =>
                run(async () =>
                  setCapabilities(
                    await command<AppCapabilities>("app.capabilities"),
                  ),
                )
              }
              onStart={(settings) =>
                void run(async () => {
                  const result = await command<RecordingStatus>(
                    "recording.start",
                    { projectId: project.id, settings },
                  );
                  setRecording(result);
                  setModal(null);
                  setProject(
                    await command<Project>("project.open", {
                      projectId: project.id,
                    }),
                  );
                })
              }
            />
          )}
          {modal === "settings" && (
            <SettingsDialog
              settings={settings}
              mcp={capabilities?.mcp}
              models={models}
              busy={busy}
              onClose={() => setModal(null)}
              onSave={(params) =>
                void run(async () => {
                  await command("settings.update", params);
                  await refreshSettings();
                  setNotice("Settings saved");
                })
              }
              onKey={async (provider, key) => {
                await run(async () => {
                  await command(key ? "keychain.set" : "keychain.delete", {
                    provider,
                    ...(key ? { key } : {}),
                  });
                  await refreshSettings();
                  setNotice(
                    key ? "API key saved in Keychain" : "API key removed",
                  );
                });
              }}
              onDownload={(model) =>
                void startJob("ai.models/download", { model })
              }
            />
          )}
          {modal === "export" && project && (
            <ExportDialog
              project={project}
              busy={busy}
              onClose={() => setModal(null)}
              onExport={async (size) => {
                const path = await pickPath("export", project.name);
                if (!path) return;
                const result = await startJob("export.start", {
                  path,
                  ...size,
                });
                if (result) setModal(null);
              }}
              onError={setError}
            />
          )}
        </div>
      </DraftPreviewContext.Provider>
    </ErrorContext.Provider>
  );
}

function ProjectThumbnail({ thumbnail }: { thumbnail: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (/^(data:|https?:)/.test(thumbnail)) setSrc(thumbnail);
    else if (desktop) {
      void import("@tauri-apps/api/core").then(({ convertFileSrc }) =>
        setSrc(convertFileSrc(thumbnail)),
      );
    }
  }, [thumbnail]);
  return src ? (
    <img src={src} alt="Recorded screen thumbnail" />
  ) : (
    <FileVideo size={32} />
  );
}

function NativePreview({
  project,
  hidden,
  onError,
}: {
  project: Project;
  hidden: boolean;
  onError: (error: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const output = outputSize(project);
  const aspect = output.width / output.height;
  const previewWidth = Math.min(stageSize.width, stageSize.height * aspect);
  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setStageSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!desktop) {
      setReady(true);
      return;
    }
    setReady(false);
    void command("preview.load", { projectId: project.id })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) onError(messageOf(e));
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, onError]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !desktop) return;
    const bounds = () => {
      const r = el.getBoundingClientRect();
      void command("preview.bounds", {
        x: r.x,
        y: r.y,
        width: hidden || !ready ? 0 : r.width,
        height: hidden || !ready ? 0 : r.height,
      }).catch(() => {});
    };
    bounds();
    const observer = new ResizeObserver(bounds);
    observer.observe(el);
    window.addEventListener("resize", bounds);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", bounds);
      void command("preview.bounds", { x: 0, y: 0, width: 0, height: 0 }).catch(
        () => {},
      );
    };
  }, [hidden, ready]);
  return (
    <div className="preview-stage" ref={stageRef}>
      <div
        className="native-preview"
        ref={ref}
        style={{
          width: previewWidth,
          height: previewWidth / aspect,
        }}
      >
        {!ready ? (
          <div className="preview-placeholder">
            <LoaderCircle size={25} className="spin" />
            <span>Preparing preview…</span>
          </div>
        ) : !desktop ? (
          <div className="preview-placeholder">
            <Monitor size={30} />
            <span>Native video preview</span>
            <p>
              Open the desktop app to play this recording.
              <br />
              Your project and editing controls are connected.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
function PanelIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="panel-intro">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function RangeSummary({ selection }: { selection: Range }) {
  return (
    <div className="range-summary">
      <span>Selected range</span>
      <code>
        {seconds(selection.startMs)}s — {seconds(selection.endMs)}s
      </code>
    </div>
  );
}

function CanvasPanel({
  project,
  apply,
  importImage,
  onError,
}: {
  project: Project;
  apply: (ops: EditOperation[], revision?: number) => Promise<void>;
  importImage: () => Promise<
    | { asset: Project["assets"][number] | undefined; revision: number }
    | undefined
  >;
  onError: (error: string) => void;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const preview = (settings: Partial<CanvasSettings>) =>
    draftPreview([{ type: "canvas.update", settings }]);
  const canvas =
    project.edits.canvas ??
    ({
      ...defaultCanvas(),
      aspectRatio: "source",
      background: "hidden",
      padding: 0,
      radius: 0,
      shadow: 0,
      frame: "none",
    } as CanvasSettings);
  const update = (settings: Partial<CanvasSettings>, revision?: number) =>
    void apply([{ type: "canvas.update", settings }], revision);
  return (
    <>
      <PanelIntro
        title="Give your screen some space."
        text="Frame your recording for the place you’ll share it."
      />
      <h3 className="panel-section">CANVAS</h3>
      <div
        className="aspect-options"
        role="group"
        aria-label="Canvas aspect ratio"
      >
        {(["source", "16:9", "1:1", "9:16", "4:5"] as const).map(
          (aspectRatio) => (
            <button
              key={aspectRatio}
              aria-pressed={canvas.aspectRatio === aspectRatio}
              className={canvas.aspectRatio === aspectRatio ? "selected" : ""}
              onClick={() => update({ aspectRatio })}
            >
              <span
                style={{
                  aspectRatio:
                    aspectRatio === "source"
                      ? "16/10"
                      : aspectRatio.replace(":", "/"),
                }}
              />
              {aspectRatio === "source" ? "Source" : aspectRatio}
            </button>
          ),
        )}
      </div>
      <div className="panel-divider" />
      <h3 className="panel-section">BACKGROUND</h3>
      <div
        className="background-options"
        role="group"
        aria-label="Background type"
      >
        {(["wallpaper", "gradient", "color", "image", "hidden"] as const).map(
          (background) => (
            <button
              key={background}
              className={canvas.background === background ? "selected" : ""}
              aria-pressed={canvas.background === background}
              onClick={() => {
                if (background === "image" && !canvas.assetId) {
                  void importImage()
                    .then((result) => {
                      if (result?.asset)
                        update(
                          { background, assetId: result.asset.id },
                          result.revision,
                        );
                    })
                    .catch((e) => onError(messageOf(e)));
                } else update({ background });
              }}
            >
              {background === "hidden"
                ? "Hidden"
                : background[0]!.toUpperCase() + background.slice(1)}
            </button>
          ),
        )}
      </div>
      {canvas.background === "wallpaper" && (
        <div
          className="wallpaper-options"
          role="group"
          aria-label="Wallpaper preset"
        >
          {(["aurora", "sunset", "ocean", "dusk"] as const).map((wallpaper) => (
            <button
              className={`wallpaper-swatch ${wallpaper} ${canvas.wallpaper === wallpaper ? "selected" : ""}`}
              key={wallpaper}
              aria-pressed={canvas.wallpaper === wallpaper}
              onClick={() => update({ wallpaper })}
            >
              <span>{wallpaper[0]!.toUpperCase() + wallpaper.slice(1)}</span>
              {canvas.wallpaper === wallpaper && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
      {(canvas.background === "color" || canvas.background === "gradient") && (
        <div className="two-columns">
          <Field
            label={canvas.background === "gradient" ? "Start color" : "Color"}
          >
            <input
              type="color"
              value={canvas.color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </Field>
          {canvas.background === "gradient" && (
            <Field label="End color">
              <input
                type="color"
                value={canvas.gradientTo}
                onChange={(e) => update({ gradientTo: e.target.value })}
              />
            </Field>
          )}
        </div>
      )}
      {canvas.background === "gradient" && (
        <Slider
          label="Gradient angle"
          min={0}
          max={360}
          step={1}
          suffix="°"
          value={canvas.gradientAngle}
          onChange={(gradientAngle) => update({ gradientAngle })}
          onPreview={(gradientAngle) => preview({ gradientAngle })}
        />
      )}
      {canvas.background === "image" && (
        <>
          <Field label="Background image">
            <select
              value={canvas.assetId ?? ""}
              onChange={(e) => update({ assetId: e.target.value })}
            >
              <option value="" disabled>
                Select an image
              </option>
              {project.assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            className="button secondary full"
            onClick={() =>
              void importImage()
                .then((result) => {
                  if (result?.asset)
                    update({ assetId: result.asset.id }, result.revision);
                })
                .catch((e) => onError(messageOf(e)))
            }
          >
            <ImagePlus size={14} />
            Import background image
          </button>
        </>
      )}
      {["gradient", "wallpaper", "image"].includes(canvas.background) && (
        <Slider
          label="Background blur"
          min={0}
          max={60}
          step={1}
          suffix=" px"
          value={canvas.blur}
          onChange={(blur) => update({ blur })}
          onPreview={(blur) => preview({ blur })}
        />
      )}
      {canvas.background === "hidden" && (
        <p className="helper">
          A plain canvas without a decorative background.
        </p>
      )}
      <div className="panel-divider" />
      <h3 className="panel-section">SCREEN FRAME</h3>
      <Field label="Frame style">
        <select
          value={canvas.frame}
          onChange={(e) =>
            update({ frame: e.target.value as CanvasSettings["frame"] })
          }
        >
          <option value="none">Hidden</option>
          <option value="minimal">Minimal</option>
          <option value="browser">Browser</option>
        </select>
      </Field>
      {canvas.frame === "browser" && (
        <Field label="Window title">
          <input
            key={`${project.id}-${canvas.title}`}
            defaultValue={canvas.title}
            placeholder={project.source?.title ?? project.name}
            maxLength={200}
            onBlur={(e) => {
              if (e.target.value !== canvas.title)
                update({ title: e.target.value });
            }}
          />
        </Field>
      )}
      <Slider
        label="Padding"
        max={0.2}
        value={canvas.padding}
        onChange={(padding) => update({ padding })}
        onPreview={(padding) => preview({ padding })}
      />
      <Slider
        label="Corner radius"
        max={0.1}
        step={0.005}
        value={canvas.radius}
        onChange={(radius) => update({ radius })}
        onPreview={(radius) => preview({ radius })}
      />
      <Slider
        label="Shadow"
        value={canvas.shadow}
        onChange={(shadow) => update({ shadow })}
        onPreview={(shadow) => preview({ shadow })}
      />
    </>
  );
}

function CameraPanel({
  project,
  selection,
  apply,
}: {
  project: Project;
  selection: Range;
  apply: (ops: EditOperation[]) => Promise<void>;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const camera = project.edits.camera;
  const preview = (settings: Partial<typeof camera>) =>
    draftPreview([{ type: "camera.update", settings }]);
  const output = outputSize(project);
  const aspect = output.width / output.height;
  const update = (settings: Partial<typeof camera>) =>
    void apply([{ type: "camera.update", settings }]);
  return (
    <>
      <PanelIntro
        title="Put a face to your story."
        text="Your camera stays on its own track, so you’re always in control."
      />
      {project.source && !project.source.camera && (
        <p className="inline-note">This recording has no camera track.</p>
      )}
      <Switch
        label="Show camera"
        checked={camera.visible}
        onChange={(v) => update({ visible: v })}
      />
      <h3 className="panel-section">APPEARANCE</h3>
      <div className="shape-options">
        <button
          className={camera.shape === "circle" ? "selected" : ""}
          aria-pressed={camera.shape === "circle"}
          onClick={() => update({ shape: "circle" })}
        >
          <span className="shape-demo circle">
            <Camera size={18} />
          </span>
          Circle
        </button>
        <button
          className={camera.shape === "square" ? "selected" : ""}
          aria-pressed={camera.shape === "square"}
          onClick={() => update({ shape: "square" })}
        >
          <span className="shape-demo square">
            <Camera size={18} />
          </span>
          Square
        </button>
      </div>
      <Slider
        label="Size"
        min={0.08}
        max={Math.min(0.5, 1 / aspect)}
        value={camera.size}
        onPreview={(v) =>
          preview({
            size: v,
            x: Math.min(camera.x, 1 - v),
            y: Math.max(0, Math.min(camera.y, 1 - v * aspect)),
          })
        }
        onChange={(v) =>
          update({
            size: v,
            x: Math.min(camera.x, 1 - v),
            y: Math.max(0, Math.min(camera.y, 1 - v * aspect)),
          })
        }
      />
      <Slider
        label="Horizontal position"
        max={Math.max(0, 1 - camera.size)}
        value={camera.x}
        onPreview={(x) => preview({ x })}
        onChange={(v) => update({ x: v })}
      />
      <Slider
        label="Vertical position"
        max={Math.max(0, 1 - camera.size * aspect)}
        value={camera.y}
        onPreview={(y) => preview({ y })}
        onChange={(v) => update({ y: v })}
      />
      <Switch
        label="Soft shadow"
        checked={camera.shadow}
        onChange={(v) => update({ shadow: v })}
      />
      <div className="panel-divider" />
      <h3 className="panel-section">VISIBILITY</h3>
      <RangeSummary selection={selection} />
      <div className="button-row">
        <button
          className="button secondary"
          disabled={selection.endMs <= selection.startMs}
          onClick={() =>
            void apply([{ type: "camera.hide", ...selection, hidden: true }])
          }
        >
          <EyeOff size={14} />
          Hide here
        </button>
        <button
          className="button secondary"
          disabled={selection.endMs <= selection.startMs}
          onClick={() =>
            void apply([{ type: "camera.hide", ...selection, hidden: false }])
          }
        >
          <Eye size={14} />
          Show here
        </button>
      </div>
      <p className="helper">
        Select an interval in the timeline to hide or restore your camera.
      </p>
      {camera.hiddenRanges.length > 0 && (
        <div className="interval-list">
          {camera.hiddenRanges.map((r, i) => (
            <div key={i}>
              <EyeOff size={13} />
              <span>
                {seconds(r.startMs)}s – {seconds(r.endMs)}s
              </span>
              <small>source</small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ZoomPanel({
  project,
  selection,
  apply,
  selectedId,
  onSelect,
}: {
  project: Project;
  selection: Range;
  apply: (ops: EditOperation[]) => Promise<void>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const automatic = project.edits.autoZoom ?? defaultAutoZoom();
  const cursor = project.edits.cursor;
  const selected = project.edits.zooms.find((z) => z.id === selectedId);
  const changeAutomatic = (settings: Partial<typeof automatic>) =>
    void apply([{ type: "autoZoom.update", settings }]);
  return (
    <>
      <PanelIntro
        title="Bring the details into focus."
        text="Automatic zooms follow the action. Fine-tune every moment below."
      />
      <Switch
        label="Auto zoom new recordings"
        checked={automatic.enabled}
        onChange={(enabled) => changeAutomatic({ enabled })}
      />
      <Slider
        label="Default zoom depth"
        min={1.1}
        max={4}
        step={0.1}
        suffix="×"
        value={automatic.scale}
        onChange={(scale) => changeAutomatic({ scale })}
      />
      <div className="two-columns">
        <Field label="Motion">
          <select
            value={automatic.motion}
            onChange={(e) =>
              changeAutomatic({ motion: e.target.value as "gentle" | "snappy" })
            }
          >
            <option value="gentle">Gentle</option>
            <option value="snappy">Snappy</option>
          </select>
        </Field>
        <Field label="Hold (seconds)">
          <input
            key={`hold-${automatic.holdMs}`}
            type="number"
            min={0.2}
            max={20}
            step={0.1}
            defaultValue={automatic.holdMs / 1000}
            onBlur={(e) => {
              if (number(e.target.value) * 1000 !== automatic.holdMs)
                changeAutomatic({ holdMs: number(e.target.value) * 1000 });
            }}
          />
        </Field>
      </div>
      <Switch
        label="Follow cursor by default"
        checked={automatic.followCursor}
        onChange={(followCursor) => changeAutomatic({ followCursor })}
      />
      <button
        className="button secondary full"
        disabled={!project.source}
        onClick={() => {
          onSelect(null);
          void apply([{ type: "zooms.auto" }]);
        }}
      >
        <WandSparkles size={15} />
        {project.edits.zooms.length
          ? "Redetect automatic zooms"
          : "Generate automatic zooms"}
      </button>
      <p className="helper">
        Uses recorded interactions. Redetect replaces the current zooms and can
        be undone.
      </p>
      <div className="panel-divider" />
      <h3 className="panel-section">
        ZOOM MOMENTS <span>{project.edits.zooms.length}</span>
      </h3>
      <RangeSummary selection={selection} />
      <button
        className="button secondary full"
        disabled={selection.endMs <= selection.startMs}
        onClick={() =>
          void apply([
            {
              type: "zoom.add",
              zoom: {
                ...selection,
                scale: automatic.scale,
                x: 0.5,
                y: 0.5,
                motion: automatic.motion,
                followCursor: automatic.followCursor,
              },
            },
          ])
        }
      >
        <Plus size={15} />
        Add zoom to selection
      </button>
      <div className="zoom-list">
        {project.edits.zooms.map((z, index) => {
          const ranges = outputRanges(project.edits.segments, z);
          return (
            <button
              key={z.id}
              disabled={!ranges.length}
              className={z.id === selectedId ? "selected" : ""}
              onClick={() => onSelect(z.id)}
            >
              <ZoomIn size={14} />
              <span>
                Zoom {index + 1}
                <small>
                  {ranges.length
                    ? `${seconds(ranges[0]!.startMs)} – ${seconds(ranges.at(-1)!.endMs)}s`
                    : "Outside the current edit"}
                </small>
              </span>
              <b>{z.scale.toFixed(1)}×</b>
            </button>
          );
        })}
      </div>
      {selected && (
        <ZoomProperties
          key={`${selected.id}-${project.revision}`}
          zoom={selected}
          project={project}
          apply={apply}
          onRemove={() => onSelect(null)}
        />
      )}
      <div className="panel-divider" />
      <h3 className="panel-section">CURSOR</h3>
      <Switch
        label="Show cursor"
        checked={cursor.visible}
        onChange={(visible) =>
          void apply([{ type: "cursor.update", settings: { visible } }])
        }
      />
      <Switch
        label="Click highlight"
        checked={cursor.highlight}
        onChange={(highlight) =>
          void apply([{ type: "cursor.update", settings: { highlight } }])
        }
      />
      <Switch
        label="Smooth movement"
        checked={cursor.smooth}
        onChange={(smooth) =>
          void apply([{ type: "cursor.update", settings: { smooth } }])
        }
      />
      <Slider
        label="Cursor size"
        min={0.5}
        max={3}
        step={0.1}
        suffix="×"
        value={cursor.size}
        onChange={(size) =>
          void apply([{ type: "cursor.update", settings: { size } }])
        }
      />
    </>
  );
}

function ZoomProperties({
  zoom,
  project,
  apply,
  onRemove,
}: {
  zoom: Zoom;
  project: Project;
  apply: (ops: EditOperation[]) => Promise<void>;
  onRemove: () => void;
}) {
  const propertiesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    propertiesRef.current?.scrollIntoView({ block: "nearest" });
  }, [zoom.id]);
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const preview = (zoomPatch: Partial<Omit<Zoom, "id">>) =>
    draftPreview([{ type: "zoom.update", id: zoom.id, zoom: zoomPatch }]);
  const ranges = outputRanges(project.edits.segments, zoom);
  const range = ranges.length
    ? { startMs: ranges[0]!.startMs, endMs: ranges.at(-1)!.endMs }
    : null;
  const [start, setStart] = useState((range?.startMs ?? 0) / 1000);
  const [length, setLength] = useState(
    ((range?.endMs ?? 0) - (range?.startMs ?? 0)) / 1000,
  );
  const total = duration(project.edits.segments);
  const update = (patch: Partial<Omit<Zoom, "id">>) =>
    void apply([{ type: "zoom.update", id: zoom.id, zoom: patch }]);
  return (
    <div className="layer-properties" ref={propertiesRef}>
      <h3 className="panel-section">SELECTED ZOOM</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ startMs: start * 1000, endMs: (start + length) * 1000 });
        }}
      >
        <div className="two-columns">
          <Field label="Start (seconds)">
            <input
              type="number"
              min={0}
              max={total / 1000}
              step={0.01}
              value={start}
              onChange={(e) => setStart(number(e.target.value))}
            />
          </Field>
          <Field label="Duration (seconds)">
            <input
              type="number"
              min={0.01}
              max={Math.max(0.01, total / 1000 - start)}
              step={0.01}
              value={length}
              onChange={(e) => setLength(number(e.target.value))}
            />
          </Field>
        </div>
        <button
          className="button secondary full"
          disabled={length <= 0 || start < 0 || (start + length) * 1000 > total}
        >
          Update timing
        </button>
      </form>
      <Slider
        label="Zoom depth"
        min={1.1}
        max={4}
        step={0.1}
        suffix="×"
        value={zoom.scale}
        onChange={(scale) => update({ scale })}
        onPreview={(scale) => preview({ scale })}
      />
      <Switch
        label="Follow cursor"
        checked={zoom.followCursor ?? false}
        onChange={(followCursor) => update({ followCursor })}
      />
      {!zoom.followCursor && (
        <>
          <Slider
            label="Focus X"
            value={zoom.x}
            onChange={(x) => update({ x })}
            onPreview={(x) => preview({ x })}
          />
          <Slider
            label="Focus Y"
            value={zoom.y}
            onChange={(y) => update({ y })}
            onPreview={(y) => preview({ y })}
          />
        </>
      )}
      <Field label="Zoom motion">
        <select
          value={zoom.motion ?? "gentle"}
          onChange={(e) =>
            update({ motion: e.target.value as "gentle" | "snappy" })
          }
        >
          <option value="gentle">Gentle</option>
          <option value="snappy">Snappy</option>
        </select>
      </Field>
      <button
        className="button subtle full"
        onClick={async () => {
          await apply([{ type: "zoom.remove", id: zoom.id }]);
          onRemove();
        }}
      >
        <Trash2 size={14} />
        Remove zoom
      </button>
    </div>
  );
}

function OverlaysPanel({
  project,
  selection,
  apply,
  importImage,
  onError,
}: {
  project: Project;
  selection: Range;
  apply: (ops: EditOperation[], revision?: number) => Promise<void>;
  importImage: () => Promise<unknown>;
  onError: (error: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const overlay = project.edits.overlays.find((o) => o.id === selected);
  const update = (value: Partial<Overlay>) => {
    if (overlay)
      void apply([{ type: "overlay.update", id: overlay.id, overlay: value }]);
  };
  const defaults = {
    ...selection,
    x: 0.1,
    y: 0.12,
    width: 0.8,
    fontSize: 48,
    color: "#ffffff",
    animation: "fade" as const,
  };
  return (
    <>
      <PanelIntro
        title="Add your finishing touches."
        text="A title, a helpful image, a point worth remembering."
      />
      <RangeSummary selection={selection} />
      <Field label="Text">
        <textarea
          placeholder="Something worth saying…"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <button
        className="button secondary full"
        disabled={!text.trim() || selection.endMs <= selection.startMs}
        onClick={async () => {
          await apply([
            {
              type: "overlay.add",
              overlay: { ...defaults, kind: "text", text: text.trim() },
            },
          ]);
          setText("");
        }}
      >
        <Type size={15} />
        Add text to selection
      </button>
      <button
        className="button subtle full"
        disabled={selection.endMs <= selection.startMs}
        onClick={async () => {
          try {
            const result = await importImage();
            if (!result) return;
            const asset =
              (result as { asset?: { id: string }; id?: string }).asset ||
              (result as { id: string });
            if (asset.id)
              await apply(
                [
                  {
                    type: "overlay.add",
                    overlay: {
                      ...defaults,
                      kind: "image",
                      assetId: asset.id,
                      width: 0.35,
                    },
                  },
                ],
                (result as { revision: number }).revision,
              );
          } catch (e) {
            onError(messageOf(e));
          }
        }}
      >
        <ImagePlus size={15} />
        Add image
      </button>
      {project.assets.length > 0 && (
        <Field label="Imported images">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value)
                void apply([
                  {
                    type: "overlay.add",
                    overlay: {
                      ...defaults,
                      kind: "image",
                      assetId: e.target.value,
                      width: 0.35,
                    },
                  },
                ]);
              e.target.value = "";
            }}
            disabled={selection.endMs <= selection.startMs}
          >
            <option value="">Choose an image to add…</option>
            {project.assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="panel-divider" />
      <h3 className="panel-section">
        LAYERS <span>{project.edits.overlays.length}</span>
      </h3>
      {!project.edits.overlays.length && (
        <p className="helper">
          Your text and images will appear here. Select a timeline range to add
          your first layer.
        </p>
      )}
      <div className="layers-list">
        {project.edits.overlays.map((o) => (
          <div key={o.id} className={selected === o.id ? "selected" : ""}>
            <button onClick={() => setSelected(o.id)}>
              {o.kind === "text" ? <Type size={14} /> : <ImagePlus size={14} />}
              <span>
                {o.kind === "text"
                  ? o.text
                  : project.assets.find((a) => a.id === o.assetId)?.name ||
                    "Image"}
                <small>
                  {seconds(o.startMs)} – {seconds(o.endMs)}s · source
                </small>
              </span>
            </button>
            <IconButton
              label="Remove layer"
              onClick={() => void apply([{ type: "overlay.remove", id: o.id }])}
            >
              <Trash2 size={13} />
            </IconButton>
          </div>
        ))}
      </div>
      {overlay && (
        <div className="layer-properties" key={overlay.id}>
          <h3 className="panel-section">LAYER PROPERTIES</h3>
          {overlay.kind === "text" && (
            <>
              <Field label="Content">
                <textarea
                  defaultValue={overlay.text}
                  onBlur={(e) => {
                    if (e.target.value !== overlay.text)
                      update({ text: e.target.value });
                  }}
                />
              </Field>
              <div className="two-columns">
                <Field label="Font size">
                  <input
                    type="number"
                    min={12}
                    max={200}
                    defaultValue={overlay.fontSize}
                    onBlur={(e) => update({ fontSize: number(e.target.value) })}
                  />
                </Field>
                <Field label="Color">
                  <input
                    type="color"
                    value={overlay.color}
                    onChange={(e) => update({ color: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}
          <Slider
            label="Horizontal position"
            value={overlay.x}
            onChange={(x) => update({ x })}
          />
          <Slider
            label="Vertical position"
            value={overlay.y}
            onChange={(y) => update({ y })}
          />
          <Slider
            label="Width"
            min={0.05}
            max={1}
            value={overlay.width}
            onChange={(width) => update({ width })}
          />
          <Field label="Animation">
            <select
              value={overlay.animation}
              onChange={(e) =>
                update({ animation: e.target.value as Overlay["animation"] })
              }
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="slide">Slide in</option>
            </select>
          </Field>
          <button
            className="button secondary full"
            disabled={selection.endMs <= selection.startMs}
            onClick={() => update(selection)}
          >
            Use selected time range
          </button>
        </div>
      )}
    </>
  );
}

function SilenceControls({
  disabled,
  onAnalyze,
}: {
  disabled: boolean;
  onAnalyze: (params: Record<string, number | boolean>) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        onAnalyze({
          thresholdDb: Number(data.get("threshold")),
          minSilenceMs: Number(data.get("duration")),
          paddingMs: Number(data.get("padding")),
          preserveSystemAudio: data.get("preserve") === "on",
        });
      }}
    >
      <div className="two-columns">
        <Field label="Quiet threshold">
          <input
            name="threshold"
            type="number"
            min={-80}
            max={-10}
            step={1}
            defaultValue={-40}
          />
          <small>dB</small>
        </Field>
        <Field label="Minimum pause">
          <input
            name="duration"
            type="number"
            min={200}
            max={10000}
            step={100}
            defaultValue={700}
          />
          <small>milliseconds</small>
        </Field>
      </div>
      <Field label="Speech padding (ms)">
        <input
          type="number"
          name="padding"
          min={0}
          max={1000}
          step={50}
          defaultValue={150}
        />
      </Field>
      <label className="check-row">
        <input type="checkbox" name="preserve" defaultChecked />
        Keep pauses with system audio
      </label>
      <button className="button secondary full" disabled={disabled}>
        <Sparkles size={15} />
        Analyze quiet moments
      </button>
    </form>
  );
}

function TranscriptPanel({
  project,
  settings,
  apply,
  onJob,
  onSelect,
  onError,
}: {
  project: Project;
  settings: Settings | null;
  apply: (ops: EditOperation[]) => Promise<void>;
  onJob: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  onSelect: (range: Range) => void;
  onError: (error: string) => void;
}) {
  const captions = project.edits.captions;
  const rangeFor = (segment: TranscriptSegment) => {
    const ranges = outputRanges(project.edits.segments, segment);
    return ranges.length
      ? { startMs: ranges[0]!.startMs, endMs: ranges.at(-1)!.endMs }
      : null;
  };
  return (
    <>
      <PanelIntro
        title="Every word, right where it belongs."
        text="Transcribe on your device, then edit your video through its words."
      />
      <button
        className="button secondary full"
        disabled={!project.source}
        onClick={() =>
          void onJob("ai.transcribe", {
            model: settings?.transcriptionModel || "small",
            language: settings?.language || "auto",
          })
        }
      >
        <Sparkles size={15} />
        {project.transcript.length
          ? "Regenerate transcript"
          : "Generate transcript"}
      </button>
      <p className="helper">
        Uses a downloaded Whisper model. Your audio stays on your device.
      </p>
      <Switch
        label="Show subtitles in video"
        checked={captions.enabled}
        onChange={(enabled) =>
          void apply([{ type: "captions.update", settings: { enabled } }])
        }
      />
      {captions.enabled && (
        <>
          <Slider
            label="Subtitle size"
            min={16}
            max={96}
            step={1}
            suffix=" px"
            value={captions.fontSize}
            onChange={(fontSize) =>
              void apply([{ type: "captions.update", settings: { fontSize } }])
            }
          />
          <div className="two-columns">
            <Field label="Text color">
              <input
                type="color"
                value={captions.color}
                onChange={(e) =>
                  void apply([
                    {
                      type: "captions.update",
                      settings: { color: e.target.value },
                    },
                  ])
                }
              />
            </Field>
            <Field label="Background">
              <input
                type="color"
                value={captions.background}
                onChange={(e) =>
                  void apply([
                    {
                      type: "captions.update",
                      settings: { background: e.target.value },
                    },
                  ])
                }
              />
            </Field>
          </div>
        </>
      )}
      {project.transcript.length > 0 && (
        <div className="button-row">
          {(["srt", "vtt"] as const).map((format) => (
            <button
              key={format}
              className="button subtle"
              onClick={async () => {
                try {
                  const path = await pickPath(format, project.name);
                  if (path)
                    await command("transcript.export", {
                      projectId: project.id,
                      format,
                      path,
                    });
                } catch (e) {
                  onError(messageOf(e));
                }
              }}
            >
              <Download size={13} />
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <div className="panel-divider" />
      <h3 className="panel-section">
        TRANSCRIPT <span>{project.transcript.length} segments</span>
      </h3>
      <div className="transcript-list">
        {project.transcript.map((segment) => {
          const range = rangeFor(segment);
          return (
            <div key={segment.id} className={!range ? "removed" : ""}>
              <button
                className="transcript-time"
                disabled={!range}
                onClick={() => range && onSelect(range)}
              >
                {formatTime(range?.startMs ?? segment.startMs)}
                <span>{range ? "Select" : "Cut"}</span>
              </button>
              <textarea
                aria-label={`Transcript at ${formatTime(segment.startMs)}`}
                defaultValue={segment.text}
                key={`${segment.id}-${segment.text}`}
                rows={Math.max(2, Math.ceil(segment.text.length / 36))}
                onBlur={(e) => {
                  if (e.target.value !== segment.text)
                    void apply([
                      {
                        type: "transcript.text",
                        id: segment.id,
                        text: e.target.value,
                      },
                    ]);
                }}
              />
              {range && (
                <button
                  className="transcript-cut"
                  onClick={() => void apply([{ type: "cut", ...range }])}
                >
                  <Scissors size={12} />
                  Cut this sentence
                </button>
              )}
            </div>
          );
        })}
        {!project.transcript.length && (
          <p className="helper">
            Your transcript will appear here after processing.
          </p>
        )}
      </div>
    </>
  );
}

function AssistantPanel({
  messages,
  settings,
  disabled,
  onSettings,
  onSend,
}: {
  messages: { role: "user" | "assistant"; text: string }[];
  settings: Settings | null;
  disabled: boolean;
  onSettings: () => void;
  onSend: (prompt: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const configured =
    settings?.provider === "anthropic"
      ? settings.hasAnthropicKey
      : settings?.hasOpenaiKey;
  return (
    <div className="assistant-panel">
      <div className="assistant-intro">
        <span>
          <Sparkles size={22} />
        </span>
        <h3>Your creative co-pilot.</h3>
        <p>
          Describe the edit.
          <br />
          Keep the creative decisions.
        </p>
      </div>
      {!configured && (
        <div className="inline-note">
          <p>
            Connect your own OpenAI or Anthropic API key to use the assistant.
          </p>
          <button className="button secondary full" onClick={onSettings}>
            Connect an API key
          </button>
        </div>
      )}
      <div className="assistant-examples">
        <span>TRY SOMETHING LIKE</span>
        {[
          "Hide my camera for the first 20 seconds.",
          "Add a title to the opening five seconds.",
          "Write a YouTube description and chapters.",
        ].map((example) => (
          <button key={example} onClick={() => setPrompt(example)}>
            {example}
            <ArrowRight size={13} />
          </button>
        ))}
      </div>
      <div className="chat-messages" aria-live="polite">
        {messages.map((message, i) => (
          <div className={`chat-message ${message.role}`} key={i}>
            <span>{message.role === "user" ? "YOU" : "ASSISTANT"}</span>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      <form
        className="assistant-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!prompt.trim() || disabled || !configured) return;
          const value = prompt.trim();
          setPrompt("");
          void onSend(value);
        }}
      >
        <textarea
          aria-label="Ask AI assistant"
          placeholder="What would you like to change?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <div>
          <span>
            {settings?.provider === "anthropic" ? "Anthropic" : "OpenAI"}
          </span>
          <button
            aria-label="Send to assistant"
            disabled={disabled || !configured || !prompt.trim()}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
      <p className="helper assistant-privacy">
        <ShieldCheck size={11} />
        Only transcript, edit information, and your request are sent to your
        provider.
      </p>
    </div>
  );
}

type TimelineDrag = {
  projectId: string;
  revision: number;
  kind: "zoom" | "clip";
  id: string;
  index: number;
  edge: "start" | "end" | "move";
  originX: number;
  pixels: number;
  original: Range;
  next: Range;
};
function Timeline({
  project,
  total,
  timeMs,
  selection,
  setSelection,
  seek,
  apply,
  disabled,
  selectedZoom,
  onSelectZoom,
}: {
  project: Project;
  total: number;
  timeMs: number;
  selection: Range;
  setSelection: (range: Range) => void;
  seek: (time: number) => Promise<void>;
  apply: (ops: EditOperation[], revision?: number) => Promise<void>;
  disabled: boolean;
  selectedZoom: string | null;
  onSelectZoom: (id: string) => void;
}) {
  const { send: draftPreview } = useContext(DraftPreviewContext);
  const [zoom, setZoom] = useState(1);
  const [clipMenu, setClipMenu] = useState<number | null>(null);
  const [draft, setDraft] = useState<TimelineDrag | null>(null);
  const drag = useRef<TimelineDrag | null>(null);
  const dragPointer = useRef<{ target: HTMLElement; id: number } | null>(null);
  const tracks = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ratio = (value: number) =>
    total ? `${Math.max(0, Math.min(100, (value / total) * 100))}%` : "0%";
  let offset = 0;
  const intervals = project.edits.segments.map((segment, index) => {
    const result = {
      ...segment,
      index,
      outputStart: offset,
      outputEnd: offset + segmentDuration(segment),
    };
    offset = result.outputEnd;
    return result;
  });
  const selected = selection.endMs > selection.startMs;
  const selectedClip = intervals.findIndex(
    (s) =>
      Math.abs(s.outputStart - selection.startMs) < 0.1 &&
      Math.abs(s.outputEnd - selection.endMs) < 0.1,
  );
  const gaps: (Range & { outputMs: number })[] = [];
  let lastSource = 0,
    outputMs = 0;
  for (const segment of intervals) {
    if (segment.startMs > lastSource)
      gaps.push({ startMs: lastSource, endMs: segment.startMs, outputMs });
    lastSource = segment.endMs;
    outputMs = segment.outputEnd;
  }
  if (project.source && lastSource < project.source.durationMs)
    gaps.push({
      startMs: lastSource,
      endMs: project.source.durationMs,
      outputMs: total,
    });
  useEffect(() => {
    setClipMenu(null);
    if (drag.current && !currentDrag(drag.current)) cancelDrag();
  }, [project.id, project.revision, disabled]);
  useEffect(
    () => () => {
      if (drag.current) draftPreview(null);
      releaseDragPointer();
    },
    [],
  );
  useEffect(() => {
    if (clipMenu === null) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setClipMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClipMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [clipMenu]);
  function currentDrag(value: TimelineDrag) {
    return (
      !disabled &&
      value.projectId === project.id &&
      value.revision === project.revision &&
      (value.kind === "clip"
        ? !!project.source && !!intervals[value.index]
        : project.edits.zooms.some((z) => z.id === value.id))
    );
  }
  function releaseDragPointer() {
    const pointer = dragPointer.current;
    dragPointer.current = null;
    if (pointer?.target.hasPointerCapture(pointer.id))
      pointer.target.releasePointerCapture(pointer.id);
  }
  function cancelDrag() {
    drag.current = null;
    releaseDragPointer();
    setDraft(null);
    draftPreview(null);
  }
  function startDrag(
    e: React.PointerEvent<HTMLElement>,
    kind: "zoom" | "clip",
    id: string,
    index: number,
    edge: TimelineDrag["edge"],
    range: Range,
  ) {
    if (disabled || !total || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    releaseDragPointer();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragPointer.current = { target: e.currentTarget, id: e.pointerId };
    const value: TimelineDrag = {
      projectId: project.id,
      revision: project.revision,
      kind,
      id,
      index,
      edge,
      originX: e.clientX,
      pixels: tracks.current?.getBoundingClientRect().width || 1,
      original: range,
      next: range,
    };
    drag.current = value;
    setDraft(value);
    if (kind === "zoom") onSelectZoom(id);
  }
  function moveDrag(e: React.PointerEvent<HTMLElement>) {
    const value = drag.current;
    if (!value || dragPointer.current?.id !== e.pointerId) return;
    e.stopPropagation();
    if (!currentDrag(value)) {
      cancelDrag();
      return;
    }
    const delta = ((e.clientX - value.originX) / value.pixels) * total;
    const original = value.original;
    let next: Range;
    if (value.kind === "clip") {
      const segment = intervals[value.index]!;
      const sourceDelta = delta * (segment.speed ?? 1);
      const minimum = intervals[value.index - 1]?.endMs ?? 0;
      const maximum =
        intervals[value.index + 1]?.startMs ?? project.source!.durationMs;
      next =
        value.edge === "start"
          ? {
              startMs: Math.max(
                minimum,
                Math.min(original.endMs - 1, original.startMs + sourceDelta),
              ),
              endMs: original.endMs,
            }
          : {
              startMs: original.startMs,
              endMs: Math.min(
                maximum,
                Math.max(original.startMs + 1, original.endMs + sourceDelta),
              ),
            };
    } else if (value.edge === "move") {
      const length = original.endMs - original.startMs;
      const startMs = Math.max(
        0,
        Math.min(total - length, original.startMs + delta),
      );
      next = { startMs, endMs: startMs + length };
    } else
      next =
        value.edge === "start"
          ? {
              startMs: Math.max(
                0,
                Math.min(original.endMs - 1, original.startMs + delta),
              ),
              endMs: original.endMs,
            }
          : {
              startMs: original.startMs,
              endMs: Math.min(
                total,
                Math.max(original.startMs + 1, original.endMs + delta),
              ),
            };
    drag.current = { ...value, next };
    setDraft(drag.current);
    draftPreview(
      value.kind === "zoom"
        ? [{ type: "zoom.update", id: value.id, zoom: next }]
        : [
            {
              type: "clip.trim",
              index: value.index,
              sourceStartMs: next.startMs,
              sourceEndMs: next.endMs,
            },
          ],
    );
  }
  function finishDrag(e: React.PointerEvent<HTMLElement>) {
    const value = drag.current;
    if (!value || dragPointer.current?.id !== e.pointerId) return;
    e.stopPropagation();
    if (!currentDrag(value)) {
      cancelDrag();
      return;
    }
    releaseDragPointer();
    drag.current = null;
    setDraft(null);
    if (
      Math.abs(value.original.startMs - value.next.startMs) +
        Math.abs(value.original.endMs - value.next.endMs) <
      0.01
    ) {
      draftPreview(null);
      return;
    }
    if (value.kind === "zoom")
      void apply(
        [{ type: "zoom.update", id: value.id, zoom: value.next }],
        value.revision,
      );
    else
      void apply(
        [
          {
            type: "clip.trim",
            index: value.index,
            sourceStartMs: value.next.startMs,
            sourceEndMs: value.next.endMs,
          },
        ],
        value.revision,
      );
  }
  const pointerEvents = {
    onPointerMove: moveDrag,
    onPointerUp: finishDrag,
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      cancelDrag();
    },
  };
  const menuClip = clipMenu === null ? undefined : intervals[clipMenu];
  const canMerge = (index: number) => {
    const before = intervals[index],
      after = intervals[index + 1];
    return (
      !!before &&
      !!after &&
      Math.abs(before.endMs - after.startMs) < 0.01 &&
      (before.speed ?? 1) === (after.speed ?? 1)
    );
  };
  function clipAction(operations: EditOperation[]) {
    setClipMenu(null);
    void apply(operations);
  }
  return (
    <section className="timeline">
      <div className="timeline-toolbar">
        <div>
          <span className="timeline-title">Timeline</span>
          <span className="toolbar-divider" />
          <IconButton
            label="Split at playhead"
            disabled={disabled || timeMs <= 0 || timeMs >= total}
            onClick={() => void apply([{ type: "split", atMs: timeMs }])}
          >
            <Scissors size={16} />
          </IconButton>
          <button
            className="button tiny"
            disabled={disabled || !selected}
            onClick={() => void apply([{ type: "cut", ...selection }])}
          >
            Cut selection
          </button>
          <button
            className="button tiny"
            disabled={disabled || !selected}
            onClick={() => void apply([{ type: "trim", ...selection }])}
          >
            Keep selection
          </button>
          <select
            className="timeline-speed"
            aria-label="Playback speed for selection"
            disabled={disabled || !selected}
            value={
              selectedClip >= 0
                ? String(intervals[selectedClip]!.speed ?? 1)
                : ""
            }
            onChange={(e) =>
              void apply([
                { type: "speed", ...selection, speed: Number(e.target.value) },
              ])
            }
          >
            <option value="" disabled>
              Speed
            </option>
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8].map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
          <IconButton
            label="Selected clip actions"
            disabled={disabled || selectedClip < 0}
            onClick={() => setClipMenu(selectedClip)}
          >
            <MoreHorizontal size={16} />
          </IconButton>
          {gaps.length > 0 && (
            <select
              className="restore-select"
              aria-label="Restore deleted footage"
              defaultValue=""
              disabled={disabled}
              onChange={(e) => {
                const gap = gaps[Number(e.target.value)];
                if (gap)
                  void apply([
                    {
                      type: "source.restore",
                      startMs: gap.startMs,
                      endMs: gap.endMs,
                    },
                  ]);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Restore cut…
              </option>
              {gaps.map((gap, i) => (
                <option key={i} value={i}>
                  {seconds(gap.startMs)}–{seconds(gap.endMs)}s source
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="timeline-range">
          <label>
            IN
            <input
              type="number"
              aria-label="Selection start in seconds"
              min={0}
              max={total / 1000}
              step={0.01}
              value={seconds(selection.startMs)}
              onChange={(e) => {
                const startMs = Math.max(
                  0,
                  Math.min(total, number(e.target.value) * 1000),
                );
                setSelection({
                  startMs,
                  endMs: Math.max(startMs, selection.endMs),
                });
              }}
            />
          </label>
          <label>
            OUT
            <input
              type="number"
              aria-label="Selection end in seconds"
              min={selection.startMs / 1000}
              max={total / 1000}
              step={0.01}
              value={seconds(selection.endMs)}
              onChange={(e) =>
                setSelection({
                  ...selection,
                  endMs: Math.max(
                    selection.startMs,
                    Math.min(total, number(e.target.value) * 1000),
                  ),
                })
              }
            />
          </label>
          <IconButton
            label="Select entire video"
            disabled={!total}
            onClick={() => setSelection({ startMs: 0, endMs: total })}
          >
            <Maximize2 size={14} />
          </IconButton>
        </div>
        <label className="timeline-zoom">
          <ZoomIn size={14} />
          <input
            aria-label="Timeline zoom"
            type="range"
            min={1}
            max={5}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="timeline-content">
        <div className="track-labels">
          <div />
          <span>
            <Monitor size={13} />
            Screen
          </span>
          <span>
            <Camera size={13} />
            Camera
          </span>
          <span>
            <Mic size={13} />
            Audio
          </span>
          <span>
            <Layers size={13} />
            Effects
          </span>
        </div>
        <div className="timeline-scroll">
          <div
            className="timeline-tracks"
            ref={tracks}
            style={{ width: `${zoom * 100}%` }}
          >
            <div
              className="timeline-ruler"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                void seek(((e.clientX - rect.left) / rect.width) * total);
              }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} style={{ left: `${i * 12.5}%` }}>
                  {formatTime((total / 8) * i)}
                </span>
              ))}
            </div>
            <div className="track screen-track">
              {intervals.map((segment) => {
                const isDraft =
                  draft?.kind === "clip" && draft.index === segment.index;
                const current = isDraft ? draft.next : segment;
                const start =
                  segment.outputStart +
                  (current.startMs - segment.startMs) / (segment.speed ?? 1);
                const end =
                  segment.outputEnd +
                  (current.endMs - segment.endMs) / (segment.speed ?? 1);
                return (
                  <div
                    key={`${segment.startMs}-${segment.endMs}-${segment.index}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Screen clip ${segment.index + 1}, ${segment.speed ?? 1} times speed`}
                    className={`clip screen-clip ${selectedClip === segment.index ? "selected" : ""}`}
                    style={{ left: ratio(start), width: ratio(end - start) }}
                    onClick={() => {
                      setSelection({
                        startMs: segment.outputStart,
                        endMs: segment.outputEnd,
                      });
                      void seek(segment.outputStart);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelection({
                          startMs: segment.outputStart,
                          endMs: segment.outputEnd,
                        });
                        setClipMenu(segment.index);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelection({
                        startMs: segment.outputStart,
                        endMs: segment.outputEnd,
                      });
                      setClipMenu(segment.index);
                    }}
                  >
                    <button
                      className="trim-handle start"
                      aria-label={`Trim start of clip ${segment.index + 1}`}
                      title="Drag to trim; use clip actions for exact times"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClipMenu(segment.index);
                      }}
                      onPointerDown={(e) =>
                        startDrag(
                          e,
                          "clip",
                          "",
                          segment.index,
                          "start",
                          segment,
                        )
                      }
                      {...pointerEvents}
                    />
                    <Monitor size={12} />
                    <span>
                      Screen {intervals.length > 1 ? segment.index + 1 : ""}
                    </span>
                    <b className="clip-speed">{segment.speed ?? 1}×</b>
                    <span className="clip-end">{formatTime(end - start)}</span>
                    <button
                      className="trim-handle end"
                      aria-label={`Trim end of clip ${segment.index + 1}`}
                      title="Drag to trim; use clip actions for exact times"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClipMenu(segment.index);
                      }}
                      onPointerDown={(e) =>
                        startDrag(e, "clip", "", segment.index, "end", segment)
                      }
                      {...pointerEvents}
                    />
                  </div>
                );
              })}
              {gaps.map((gap, i) => (
                <button
                  key={`gap-${i}`}
                  className="source-gap"
                  style={{ left: ratio(gap.outputMs) }}
                  disabled={disabled}
                  aria-label={`Restore cut from source ${seconds(gap.startMs)} to ${seconds(gap.endMs)} seconds`}
                  title={`Restore ${seconds(gap.endMs - gap.startMs)}s of deleted footage`}
                  onClick={() =>
                    void apply([
                      {
                        type: "source.restore",
                        startMs: gap.startMs,
                        endMs: gap.endMs,
                      },
                    ])
                  }
                >
                  <Plus size={11} />
                </button>
              ))}
              {!project.source && (
                <span className="empty-track-label">
                  Your recording will appear here
                </span>
              )}
            </div>
            <div className="track">
              {project.source?.camera && (
                <>
                  <div
                    className="clip camera-clip"
                    style={{
                      width: "100%",
                      opacity: project.edits.camera.visible ? 1 : 0.25,
                    }}
                  >
                    <Camera size={12} />
                    <span>Camera</span>
                  </div>
                  {project.edits.camera.hiddenRanges
                    .flatMap((r) => outputRanges(project.edits.segments, r))
                    .map((r, i) => (
                      <div
                        key={i}
                        className="camera-hidden"
                        style={{
                          left: ratio(r.startMs),
                          width: ratio(r.endMs - r.startMs),
                        }}
                        title="Camera hidden"
                      >
                        <EyeOff size={12} />
                      </div>
                    ))}
                </>
              )}
            </div>
            <div className="track">
              {(project.source?.microphone || project.source?.systemAudio) && (
                <div className="clip audio-clip" style={{ width: "100%" }}>
                  <AudioLines size={13} />
                  <span>
                    {[
                      project.source.microphone && "Microphone",
                      project.source.systemAudio && "System audio",
                    ]
                      .filter(Boolean)
                      .join(" + ")}
                  </span>
                  <span className="audio-track-line" />
                </div>
              )}
            </div>
            <div className="track effect-track">
              {project.edits.zooms.map((z) => {
                const ranges = outputRanges(project.edits.segments, z);
                if (!ranges.length) return null;
                const actual = {
                  startMs: ranges[0]!.startMs,
                  endMs: ranges.at(-1)!.endMs,
                };
                const current =
                  draft?.kind === "zoom" && draft.id === z.id
                    ? draft.next
                    : actual;
                return (
                  <div
                    key={z.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${z.scale} times zoom`}
                    className={`clip zoom-clip ${selectedZoom === z.id ? "selected" : ""}`}
                    style={{
                      left: ratio(current.startMs),
                      width: ratio(current.endMs - current.startMs),
                    }}
                    onClick={() => {
                      onSelectZoom(z.id);
                      setSelection(current);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectZoom(z.id);
                        setSelection(current);
                      }
                    }}
                    onPointerDown={(e) =>
                      startDrag(e, "zoom", z.id, -1, "move", actual)
                    }
                    {...pointerEvents}
                  >
                    <button
                      className="trim-handle start"
                      tabIndex={-1}
                      aria-label="Resize zoom start"
                      disabled={disabled}
                      onPointerDown={(e) =>
                        startDrag(e, "zoom", z.id, -1, "start", actual)
                      }
                      {...pointerEvents}
                    />
                    <ZoomIn size={11} />
                    <span>{z.scale}×</span>
                    <button
                      className="trim-handle end"
                      tabIndex={-1}
                      aria-label="Resize zoom end"
                      disabled={disabled}
                      onPointerDown={(e) =>
                        startDrag(e, "zoom", z.id, -1, "end", actual)
                      }
                      {...pointerEvents}
                    />
                  </div>
                );
              })}
              {project.edits.overlays.flatMap((o) =>
                outputRanges(project.edits.segments, o).map((r, i) => (
                  <button
                    key={`${o.id}-${i}`}
                    className="clip overlay-clip"
                    style={{
                      left: ratio(r.startMs),
                      width: ratio(r.endMs - r.startMs),
                      top: 19,
                    }}
                    onClick={() => setSelection(r)}
                    title={o.text || "Image"}
                  >
                    <Layers size={10} />
                    <span>{o.text || "Image"}</span>
                  </button>
                )),
              )}
            </div>
            {selected && (
              <div
                className="timeline-selection"
                style={{
                  left: ratio(selection.startMs),
                  width: ratio(selection.endMs - selection.startMs),
                }}
              />
            )}
            {total > 0 && (
              <div className="playhead" style={{ left: ratio(timeMs) }}>
                <span />
              </div>
            )}
            {draft && (
              <div className="drag-time-readout">
                {seconds(draft.next.startMs)} – {seconds(draft.next.endMs)}s{" "}
                {draft.kind === "clip" ? "source" : ""}
              </div>
            )}
          </div>
        </div>
      </div>
      {menuClip && (
        <div
          ref={menuRef}
          className="clip-context-menu"
          role="dialog"
          aria-label={`Clip ${menuClip.index + 1} actions`}
        >
          <div className="clip-context-header">
            <strong>Clip {menuClip.index + 1}</strong>
            <IconButton
              label="Close clip actions"
              onClick={() => setClipMenu(null)}
            >
              <X size={12} />
            </IconButton>
          </div>
          <div className="clip-context-actions">
            <Field label="Playback speed">
              <select
                value={menuClip.speed ?? 1}
                disabled={disabled}
                onChange={(e) =>
                  clipAction([
                    {
                      type: "speed",
                      startMs: menuClip.outputStart,
                      endMs: menuClip.outputEnd,
                      speed: Number(e.target.value),
                    },
                  ])
                }
              >
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8].map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}×
                  </option>
                ))}
              </select>
            </Field>
            <button
              disabled={
                disabled ||
                timeMs <= menuClip.outputStart ||
                timeMs >= menuClip.outputEnd
              }
              onClick={() => clipAction([{ type: "split", atMs: timeMs }])}
            >
              Split here
            </button>
            <button
              disabled={disabled || intervals.length < 2}
              onClick={() =>
                clipAction([
                  {
                    type: "cut",
                    startMs: menuClip.outputStart,
                    endMs: menuClip.outputEnd,
                  },
                ])
              }
            >
              Delete clip
            </button>
            <button
              disabled={disabled || !canMerge(menuClip.index - 1)}
              onClick={() =>
                clipAction([{ type: "clip.merge", index: menuClip.index - 1 }])
              }
            >
              Merge with previous
            </button>
            <button
              disabled={disabled || !canMerge(menuClip.index)}
              onClick={() =>
                clipAction([{ type: "clip.merge", index: menuClip.index }])
              }
            >
              Merge with next
            </button>
          </div>
          <form
            key={`${project.revision}-${menuClip.index}`}
            className="clip-trim-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              clipAction([
                {
                  type: "clip.trim",
                  index: menuClip.index,
                  sourceStartMs: Number(data.get("sourceStart")) * 1000,
                  sourceEndMs: Number(data.get("sourceEnd")) * 1000,
                },
              ]);
            }}
          >
            <Field label="Source in (s)">
              <input
                aria-label="Clip source start in seconds"
                name="sourceStart"
                type="number"
                step={0.001}
                min={(intervals[menuClip.index - 1]?.endMs ?? 0) / 1000}
                max={(menuClip.endMs - 1) / 1000}
                defaultValue={menuClip.startMs / 1000}
              />
            </Field>
            <Field label="Source out (s)">
              <input
                aria-label="Clip source end in seconds"
                name="sourceEnd"
                type="number"
                step={0.001}
                min={(menuClip.startMs + 1) / 1000}
                max={
                  (intervals[menuClip.index + 1]?.startMs ??
                    project.source!.durationMs) / 1000
                }
                defaultValue={menuClip.endMs / 1000}
              />
            </Field>
            <button className="button secondary" disabled={disabled}>
              Apply trim
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function CaptureDialog({
  capabilities,
  busy,
  onClose,
  onRefresh,
  onStart,
}: {
  capabilities: AppCapabilities | null;
  busy: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onStart: (settings: CaptureSettings) => void;
}) {
  const [kind, setKind] = useState("display");
  const [sourceId, setSourceId] = useState("");
  const [cameraId, setCameraId] = useState(capabilities?.cameras[0]?.id || "");
  const [microphoneId, setMicrophoneId] = useState(
    capabilities?.microphones[0]?.id || "",
  );
  const [systemAudio, setSystemAudio] = useState(true);
  const [shape, setShape] = useState<"circle" | "square">("circle");
  const [resolution, setResolution] = useState("4k");
  const [requestError, setRequestError] = useState("");
  const [permissionHelp, setPermissionHelp] = useState<"screen" | "input" | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [pendingSettings, setPendingSettings] =
    useState<CaptureSettings | null>(null);
  const [countdown, setCountdown] = useState(3);
  useEffect(() => {
    if (!pendingSettings) return;
    setCountdown(3);
    let remaining = 3;
    const timer = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) setCountdown(remaining);
      else {
        window.clearInterval(timer);
        setPendingSettings(null);
        onStart(pendingSettings);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pendingSettings]);
  const sources =
    capabilities?.sources.filter(
      (s) => s.kind === (kind === "region" ? "display" : kind),
    ) || [];
  useEffect(() => {
    if (!sources.find((s) => s.id === sourceId))
      setSourceId(sources[0]?.id || "");
  }, [capabilities, kind]);
  useEffect(() => {
    const refresh = () => void onRefresh();
    const visible = () => {
      if (!document.hidden) refresh();
    };
    const focused = desktop ? listen("tauri://focus", refresh) : null;
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
      void focused?.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [onRefresh]);
  async function permission(permissionKind: string) {
    setRequesting(true);
    setRequestError("");
    try {
      const permissions = await command<AppCapabilities["permissions"]>(
        "permissions.request",
        { kind: permissionKind },
      );
      if (permissionKind === "screen" || permissionKind === "input")
        setPermissionHelp(permissions[permissionKind] ? null : permissionKind);
      await onRefresh();
    } catch (e) {
      setRequestError(messageOf(e));
    } finally {
      setRequesting(false);
    }
  }
  if (pendingSettings)
    return (
      <Dialog
        title="Your recording starts in…"
        subtitle="Switch to the window you want to share."
        onClose={() => setPendingSettings(null)}
      >
        <div className="record-countdown" role="status" aria-live="assertive">
          {countdown}
        </div>
        <button
          className="button secondary full"
          onClick={() => setPendingSettings(null)}
        >
          Cancel countdown
        </button>
      </Dialog>
    );
  return (
    <Dialog
      wide
      title="Make your next take."
      subtitle="Choose what to capture. You can change the camera layout later."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setPendingSettings({
            sourceId,
            sourceKind: kind === "window" ? "window" : "display",
            cameraId: cameraId || undefined,
            microphoneId: microphoneId || undefined,
            systemAudio,
            cameraShape: shape,
            width: resolution === "4k" ? 3840 : 1920,
            height: resolution === "4k" ? 2160 : 1080,
            fps: 30,
            ...(kind === "region"
              ? {
                  region: {
                    x: Number(data.get("x")),
                    y: Number(data.get("y")),
                    width: Number(data.get("width")),
                    height: Number(data.get("height")),
                  },
                }
              : {}),
          });
        }}
      >
        <fieldset className="unstyled-fieldset" disabled={busy || requesting}>
          <div className="capture-kind">
            {[
              { id: "display", label: "Entire screen", icon: Monitor },
              { id: "window", label: "A window", icon: Square },
              { id: "region", label: "A region", icon: Maximize2 },
            ].map((item) => (
              <button
                type="button"
                className={kind === item.id ? "selected" : ""}
                onClick={() => setKind(item.id)}
                key={item.id}
              >
                <item.icon size={23} />
                <span>{item.label}</span>
                {kind === item.id && <Check size={12} />}
              </button>
            ))}
          </div>
          <Field label="Capture source">
            <div className="input-action">
              <select
                required
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="" disabled>
                  {sources.length ? "Choose a source" : "No sources available"}
                </option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.width} × {s.height}
                  </option>
                ))}
              </select>
              <IconButton
                type="button"
                label="Refresh sources"
                onClick={onRefresh}
              >
                <RefreshCw size={16} />
              </IconButton>
            </div>
          </Field>
          {kind === "region" && (
            <div className="four-columns">
              {[
                { name: "x", value: 0 },
                { name: "y", value: 0 },
                { name: "width", value: 1280 },
                { name: "height", value: 720 },
              ].map((f) => (
                <Field
                  key={f.name}
                  label={f.name.charAt(0).toUpperCase() + f.name.slice(1)}
                >
                  <input
                    type="number"
                    name={f.name}
                    min={f.name === "width" || f.name === "height" ? 2 : 0}
                    required
                    defaultValue={f.value}
                  />
                </Field>
              ))}
            </div>
          )}
          <div className="two-columns">
            <Field label="Camera">
              <select
                value={cameraId}
                onChange={(e) => setCameraId(e.target.value)}
              >
                <option value="">Off</option>
                {capabilities?.cameras.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Microphone">
              <select
                value={microphoneId}
                onChange={(e) => setMicrophoneId(e.target.value)}
              >
                <option value="">Off</option>
                {capabilities?.microphones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="two-columns">
            <Field label="Camera shape">
              <select
                value={shape}
                onChange={(e) =>
                  setShape(e.target.value as "circle" | "square")
                }
              >
                <option value="circle">Circle</option>
                <option value="square">Square</option>
              </select>
            </Field>
            <Field label="Recording quality">
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              >
                <option value="4k">4K · 30 fps</option>
                <option value="1080">1080p · 30 fps</option>
              </select>
            </Field>
          </div>
          <Switch
            label="Record system audio"
            checked={systemAudio}
            onChange={setSystemAudio}
          />
          <div className="permissions-box">
            <h3>
              <ShieldCheck size={15} />
              Permissions
            </h3>
            <div>
              {[
                {
                  key: "screen",
                  label: "Screen recording",
                  granted: capabilities?.permissions.screen,
                },
                {
                  key: "camera",
                  label: "Camera",
                  granted: capabilities?.permissions.camera === "authorized",
                },
                {
                  key: "microphone",
                  label: "Microphone",
                  granted:
                    capabilities?.permissions.microphone === "authorized",
                },
                {
                  key: "input",
                  label: "Input Monitoring",
                  granted: capabilities?.permissions.input,
                },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={p.granted}
                  onClick={() => void permission(p.key)}
                >
                  {p.granted ? <Check size={12} /> : <Plus size={12} />}
                  {p.label}
                </button>
              ))}
            </div>
            <p>
              Mouse movement and clicks are recorded automatically. Input
              Monitoring adds optional typing activity; typed text is never
              saved. Permissions refresh when you return from System Settings.
            </p>
            {permissionHelp && !capabilities?.permissions[permissionHelp] && (
              <p role="status">
                In System Settings → Privacy &amp; Security → {permissionHelp === "screen"
                  ? "Screen & System Audio Recording"
                  : "Input Monitoring"}, enable Screen Recorder, then quit and
                reopen the app. If it is already enabled but still unavailable,
                remove the old entry and use + to add this copy of Screen Recorder.
              </p>
            )}
          </div>
          {requestError && (
            <p className="inline-error" role="alert">
              {requestError}
            </p>
          )}
          <div className="dialog-actions">
            <span className="helper">Your source tracks stay separate.</span>
            <button
              className="button primary"
              disabled={!sourceId || !capabilities?.nativeAvailable || busy}
            >
              <Circle size={13} fill="currentColor" />
              {busy ? "Starting…" : "Start recording"}
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

function SettingsDialog({
  settings,
  mcp,
  models,
  busy,
  onClose,
  onSave,
  onKey,
  onDownload,
}: {
  settings: Settings | null;
  mcp?: McpConfig | null;
  models: Model[];
  busy: boolean;
  onClose: () => void;
  onSave: (settings: Record<string, unknown>) => void;
  onKey: (provider: string, key: string) => Promise<void>;
  onDownload: (model: string) => void;
}) {
  const [section, setSection] = useState("ai");
  const [provider, setProvider] = useState(settings?.provider || "openai");
  const [key, setKey] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        screenRecorder: mcp
          ? { command: mcp.command, args: mcp.args }
          : {
              command:
                "/Applications/Screen Recorder.app/Contents/Resources/bin/node",
              args: [
                "/Applications/Screen Recorder.app/Contents/Resources/mcp.mjs",
              ],
            },
      },
    },
    null,
    2,
  );
  return (
    <Dialog
      wide
      title="Make yourself at home."
      subtitle="Local AI, your own API keys, and a workspace open to your tools."
      onClose={onClose}
    >
      <div className="settings-tabs">
        <button
          className={section === "ai" ? "active" : ""}
          onClick={() => setSection("ai")}
        >
          <Sparkles size={14} />
          AI & models
        </button>
        <button
          className={section === "mcp" ? "active" : ""}
          onClick={() => setSection("mcp")}
        >
          <Keyboard size={14} />
          MCP & shortcuts
        </button>
      </div>
      {section === "ai" ? (
        <>
          <h3 className="panel-section">LOCAL TRANSCRIPTION</h3>
          <p className="helper">
            Download a multilingual Whisper model once. Transcribe in English,
            Turkish, or another supported language without an internet
            connection.
          </p>
          <div className="model-list">
            {models.map((model) => (
              <div key={model.id}>
                <span className="model-icon">
                  <AudioLines size={20} />
                </span>
                <div>
                  <strong>
                    {model.name || model.id}
                    <span>
                      {model.id === "small" ? "RECOMMENDED" : "LIGHTWEIGHT"}
                    </span>
                  </strong>
                  <p>
                    {Math.round(model.bytes / 1024 / 1024)} MB ·{" "}
                    {model.id === "small" ? "More accurate" : "Less memory"}
                  </p>
                </div>
                {model.installed ? (
                  <span className="model-installed">
                    <Check size={14} />
                    Installed
                  </span>
                ) : (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => onDownload(model.id)}
                  >
                    <Download size={14} />
                    Download
                  </button>
                )}
              </div>
            ))}
          </div>
          <form
            key={JSON.stringify(settings)}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              onSave({
                transcriptionModel: String(form.get("model")),
                language: String(form.get("language")),
                provider,
                openaiModel: String(form.get("openaiModel")),
                anthropicModel: String(form.get("anthropicModel")),
              });
            }}
          >
            <div className="two-columns">
              <Field label="Default model">
                <select
                  name="model"
                  defaultValue={settings?.transcriptionModel || "small"}
                >
                  <option value="small">Small · multilingual</option>
                  <option value="base">Base · multilingual</option>
                </select>
              </Field>
              <Field label="Transcription language">
                <select
                  name="language"
                  defaultValue={settings?.language || "auto"}
                >
                  <option value="auto">Detect automatically</option>
                  <option value="en">English</option>
                  <option value="tr">Turkish</option>
                </select>
              </Field>
            </div>
            <div className="panel-divider" />
            <h3 className="panel-section">YOUR AI ASSISTANT</h3>
            <Field label="Provider">
              <select
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as "openai" | "anthropic")
                }
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </Field>
            <div className="two-columns">
              <Field label="OpenAI model">
                <input
                  name="openaiModel"
                  required
                  defaultValue={settings?.openaiModel || ""}
                  placeholder="Model ID"
                />
              </Field>
              <Field label="Anthropic model">
                <input
                  name="anthropicModel"
                  required
                  defaultValue={settings?.anthropicModel || ""}
                  placeholder="Model ID"
                />
              </Field>
            </div>
            <div className="dialog-actions">
              <button className="button primary" disabled={busy}>
                <Save size={14} />
                Save preferences
              </button>
            </div>
          </form>
          <div className="panel-divider" />
          <Field
            label={`${provider === "openai" ? "OpenAI" : "Anthropic"} API key`}
            hint="Stored in macOS Keychain. Never stored in your project."
          >
            <div className="input-action">
              <input
                type="password"
                autoComplete="off"
                value={key}
                placeholder={
                  (
                    provider === "openai"
                      ? settings?.hasOpenaiKey
                      : settings?.hasAnthropicKey
                  )
                    ? "A key is saved in Keychain"
                    : "Paste your API key"
                }
                onChange={(e) => setKey(e.target.value)}
              />
              <button
                className="button secondary"
                disabled={!key.trim() || busy}
                onClick={async () => {
                  await onKey(provider, key.trim());
                  setKey("");
                }}
              >
                Save key
              </button>
            </div>
          </Field>
          {(provider === "openai"
            ? settings?.hasOpenaiKey
            : settings?.hasAnthropicKey) && (
            <button
              className="button subtle danger-text"
              disabled={busy}
              onClick={() => void onKey(provider, "")}
            >
              <Trash2 size={13} />
              Remove saved key
            </button>
          )}
        </>
      ) : (
        <>
          <div className="mcp-intro">
            <div className="mcp-badge">MCP</div>
            <h3>Your entire studio, one conversation away.</h3>
            <p>
              Let Claude or Codex create projects, record, edit, transcribe, and
              export through the same commands as this app.
            </p>
          </div>
          <h3 className="panel-section">CONNECT YOUR CLIENT</h3>
          <p className="helper">
            Use the bundled stdio MCP entry point. Keep Screen Recorder running
            while connecting your client. This example assumes you installed it
            in /Applications. See the MCP setup guide for development paths.
          </p>
          <pre className="config-example">{mcpConfig}</pre>
          <button
            className="button secondary full"
            onClick={() =>
              void navigator.clipboard
                .writeText(mcpConfig)
                .then(() => setCopyStatus("Copied to clipboard"))
                .catch(() =>
                  setCopyStatus("Select and copy the configuration above."),
                )
            }
          >
            {copyStatus || "Copy MCP configuration"}
          </button>
          <div className="inline-note">
            macOS recording permissions are granted through the app. Connecting
            MCP does not bypass them.
          </div>
          <h3 className="panel-section">KEYBOARD SHORTCUTS</h3>
          <div className="shortcut-list">
            <span>
              Save draft<kbd>⌘ S</kbd>
            </span>
            <span>
              Undo<kbd>⌘ Z</kbd>
            </span>
            <span>
              Redo<kbd>⇧ ⌘ Z</kbd>
            </span>
            <span>
              Play / pause preview<kbd>Space</kbd>
            </span>
            <span>
              Split at playhead<kbd>S</kbd>
            </span>
            <span>
              Set up recording<kbd>⇧ ⌘ R</kbd>
            </span>
            <span>
              Pause / resume recording (global)<kbd>⇧ ⌘ 9</kbd>
            </span>
            <span>
              Stop recording (global)<kbd>⇧ ⌘ 0</kbd>
            </span>
          </div>
        </>
      )}
    </Dialog>
  );
}

function ExportDialog({
  project,
  busy,
  onClose,
  onExport,
  onError,
}: {
  project: Project;
  busy: boolean;
  onClose: () => void;
  onExport: (size: { width: number; height: number }) => Promise<void>;
  onError: (error: string) => void;
}) {
  const [resolution, setResolution] = useState("1080");
  return (
    <Dialog
      title="Ready for the world."
      subtitle="Export a polished video. Your project stays editable."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onExport(
            outputSize(
              project,
              resolution === "4k"
                ? "4k"
                : resolution === "720"
                  ? "720"
                  : "1080",
            ),
          ).catch((e) => onError(messageOf(e)));
        }}
      >
        <div className="export-summary">
          <span>
            <FileVideo size={27} />
          </span>
          <div>
            <strong>{project.name}</strong>
            <p>
              {formatTime(duration(project.edits.segments))} · MP4 · H.264 / AAC
            </p>
          </div>
        </div>
        <Field label="Resolution">
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          >
            <option value="720">
              720p · {outputSize(project, "720").width} ×{" "}
              {outputSize(project, "720").height}
            </option>
            <option value="1080">
              1080p · {outputSize(project).width} × {outputSize(project).height}
            </option>
            <option value="4k">
              4K · {outputSize(project, "4k").width} ×{" "}
              {outputSize(project, "4k").height}
            </option>
          </select>
        </Field>
        <div className="export-details">
          <span>
            Frame rate<strong>30 fps</strong>
          </span>
          <span>
            Color<strong>SDR</strong>
          </span>
          <span>
            Subtitles
            <strong>
              {project.edits.captions.enabled ? "Burned into video" : "Off"}
            </strong>
          </span>
        </div>
        <div className="dialog-note">
          <FolderOpen size={16} />
          <span>
            Choose a destination outside your project to keep exports
            independent.
          </span>
        </div>
        <div className="dialog-actions">
          <button type="button" className="button subtle" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            <ArrowDownToLine size={15} />
            Choose location & export
          </button>
        </div>
      </form>
    </Dialog>
  );
}
