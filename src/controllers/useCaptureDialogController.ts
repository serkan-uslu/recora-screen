import { useEffect, useMemo, useState } from "react";
import { useStableCallback } from "@/src/controllers/useStableCallback";
import { listen } from "@tauri-apps/api/event";
import { type AppCapabilities, type CaptureSettings } from "@/shared/types";
import { command, desktop, messageOf } from "@/src/api";

export function useCaptureDialogController({
  capabilities,
  onRefresh,
  onStart,
}: {
  capabilities: AppCapabilities | null;
  busy: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onStart: (settings: CaptureSettings) => void;
}) {
  const start = useStableCallback(onStart);
  const [kind, setKind] = useState("display");
  const [sourceId, setSourceId] = useState("");
  const [cameraId, setCameraId] = useState(capabilities?.cameras[0]?.id || "");
  const [microphoneId, setMicrophoneId] = useState(capabilities?.microphones[0]?.id || "");
  const [systemAudio, setSystemAudio] = useState(true);
  const [shape, setShape] = useState<"circle" | "square">("circle");
  const [resolution, setResolution] = useState("4k");
  const [requestError, setRequestError] = useState("");
  const [permissionHelp, setPermissionHelp] = useState<"screen" | "input" | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<CaptureSettings | null>(null);
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
        start(pendingSettings);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pendingSettings, start]);
  const sources = useMemo(
    () =>
      capabilities?.sources.filter((s) => s.kind === (kind === "region" ? "display" : kind)) || [],
    [capabilities, kind],
  );
  useEffect(() => {
    if (!sources.find((s) => s.id === sourceId)) setSourceId(sources[0]?.id || "");
  }, [sources, sourceId]);
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
      const permissions = await command<AppCapabilities["permissions"]>("permissions.request", {
        kind: permissionKind,
      });
      if (permissionKind === "screen" || permissionKind === "input")
        setPermissionHelp(permissions[permissionKind] ? null : permissionKind);
      await onRefresh();
    } catch (e) {
      setRequestError(messageOf(e));
    } finally {
      setRequesting(false);
    }
  }
  return {
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
  };
}
