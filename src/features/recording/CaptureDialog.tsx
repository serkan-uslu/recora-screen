import {
  Check,
  Circle,
  Maximize2,
  Monitor,
  Plus,
  RefreshCw,
  ShieldCheck,
  Square,
} from "lucide-react";
import { type AppCapabilities, type CaptureSettings } from "@/shared/types";
import { IconButton } from "@/src/components/atoms/IconButton";
import { Field } from "@/src/components/molecules/Field";
import { Switch } from "@/src/components/atoms/Switch";
import { Dialog } from "@/src/components/organisms/Dialog";
import { useCaptureDialogController } from "@/src/controllers/useCaptureDialogController";

export function CaptureDialog({
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
  const {
    kind,
    setKind,
    sourceId,
    setSourceId,
    cameraId,
    setCameraId,
    microphoneId,
    setMicrophoneId,
    systemAudio,
    setSystemAudio,
    shape,
    setShape,
    resolution,
    setResolution,
    requestError,
    permissionHelp,
    requesting,
    pendingSettings,
    setPendingSettings,
    countdown,
    sources,
    permission,
  } = useCaptureDialogController({
    capabilities,
    busy,
    onClose,
    onRefresh,
    onStart,
  });
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
        <button className="button secondary full" onClick={() => setPendingSettings(null)}>
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
                aria-label="Capture source"
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
                onClick={() => {
                  void onRefresh();
                }}
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
                <Field key={f.name} label={f.name.charAt(0).toUpperCase() + f.name.slice(1)}>
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
              <select value={cameraId} onChange={(e) => setCameraId(e.target.value)}>
                <option value="">Off</option>
                {capabilities?.cameras.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Microphone">
              <select value={microphoneId} onChange={(e) => setMicrophoneId(e.target.value)}>
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
                onChange={(e) => setShape(e.target.value as "circle" | "square")}
              >
                <option value="circle">Circle</option>
                <option value="square">Square</option>
              </select>
            </Field>
            <Field label="Recording quality">
              <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                <option value="4k">4K · 30 fps</option>
                <option value="1080">1080p · 30 fps</option>
              </select>
            </Field>
          </div>
          <Switch label="Record system audio" checked={systemAudio} onChange={setSystemAudio} />
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
                  granted: capabilities?.permissions.microphone === "authorized",
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
              Mouse movement works without Input Monitoring. Enable it for precise short clicks,
              drags and optional typing activity. Typed text is never saved. Permissions refresh
              when you return from System Settings.
            </p>
            {permissionHelp && !capabilities?.permissions[permissionHelp] && (
              <p role="status">
                In System Settings → Privacy &amp; Security →{" "}
                {permissionHelp === "screen"
                  ? "Screen & System Audio Recording"
                  : "Input Monitoring"}
                , enable Screen Recorder, then quit and reopen the app. If it is already enabled but
                still unavailable, remove the old entry and use + to add this copy of Screen
                Recorder.
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
