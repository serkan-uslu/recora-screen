import type { McpPermissions } from "@/shared/types";

export type Modal =
  "new" | "record" | "settings" | "export" | "rename" | "delete" | "help" | "about" | null;
export type Tab = "general" | "camera" | "zoom" | "overlays" | "audio" | "transcript" | "ai";
export type Settings = {
  provider: "openai" | "anthropic";
  openaiModel: string;
  anthropicModel: string;
  transcriptionModel: "small" | "base";
  language: string;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
  mcpPermissions: McpPermissions;
};
export type McpConfig = { command: string; args: string[]; bundleId?: string };
export type Model = {
  id: "base" | "small";
  name: string;
  bytes: number;
  installed: boolean;
};
