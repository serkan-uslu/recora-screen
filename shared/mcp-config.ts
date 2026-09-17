import { product } from "@/shared/brand";

export type McpClient = "codex" | "claude-code" | "claude-desktop";

export function formatMcpConfig(
  client: McpClient,
  runtime: { command: string; args: string[] },
): string {
  const { command, args } = runtime;
  if (client === "codex") {
    // JSON string escapes are valid TOML basic-string escapes; DEL also needs escaping.
    const quote = (value: string) => JSON.stringify(value).replace(/\x7f/g, "\\u007f");
    return [
      `[mcp_servers.${product.mcpServerName}]`,
      `command = ${quote(command)}`,
      `args = [${args.map(quote).join(", ")}]`,
      "startup_timeout_sec = 30",
      "tool_timeout_sec = 120",
    ].join("\n");
  }
  if (client === "claude-code") {
    const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
    return `claude mcp add --transport stdio --scope user ${product.mcpServerName} -- ${[command, ...args].map(quote).join(" ")}`;
  }
  return JSON.stringify({ mcpServers: { [product.mcpServerName]: { command, args } } }, null, 2);
}
