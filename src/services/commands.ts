import { sendCommand } from "@/src/infrastructure/transport";
import type { RpcResponse } from "@/shared/types";
import { trackProjectWrite } from "@/src/services/projectSaveState";
const retriable = new Set([
  "project.create",
  "project.rename",
  "project.delete",
  "project.import",
  "recording.start",
  "recording.pause",
  "recording.resume",
  "recording.stop",
  "recording.camera",
  "timeline.apply",
  "history.undo",
  "history.redo",
  "asset.import",
  "ai.transcribe",
  "ai.cleanSilence",
  "ai.assistant",
  "ai.models/download",
  "export.start",
  "jobs.cancel",
  "settings.update",
  "keychain.set",
  "keychain.delete",
]);

export async function command<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const requestId = crypto.randomUUID();
  const request = {
    id: requestId,
    method,
    params: { ...params, ...(retriable.has(method) ? { requestId } : {}) },
  };
  return trackProjectWrite(method, params, async () => {
    const data = await sendCommand(request);
    if (data && typeof data === "object" && "error" in data && (data as RpcResponse).error) {
      throw new Error((data as RpcResponse).error!.message);
    }
    if (
      data &&
      typeof data === "object" &&
      "result" in data &&
      ("id" in data || Object.keys(data).length === 1)
    ) {
      return (data as RpcResponse).result as T;
    }
    return data as T;
  });
}
