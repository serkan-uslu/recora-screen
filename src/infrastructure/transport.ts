import { invoke } from "@tauri-apps/api/core";
import { desktop } from "@/src/infrastructure/platform";
import type { RpcRequest } from "@/shared/types";

export async function sendCommand(request: RpcRequest): Promise<unknown> {
  if (desktop) return invoke("command", { request });
  const response = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok)
    throw new Error((await response.text()) || `Service returned ${response.status}`);
  return response.json();
}
