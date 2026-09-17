import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { product } from "@/shared/brand.js";
import { formatMcpConfig } from "@/shared/mcp-config.js";

test("client configs preserve detected paths and shell metacharacters without executing them", () => {
  const runtime = {
    command: '/Users/Serkan\'s Apps/Screen "Recorder" $(exit 42) `exit 43`.app/bin/node',
    args: ["/Users/Serkan\\Apps/çalışma\n\t\u007f/mcp.mjs", "", "--literal=$HOME"],
  };
  assert.deepEqual(JSON.parse(formatMcpConfig("claude-desktop", runtime)), {
    mcpServers: { [product.mcpServerName]: runtime },
  });
  const toml = formatMcpConfig("codex", runtime).split("\n");
  assert.equal(toml[0], `[mcp_servers.${product.mcpServerName}]`);
  assert.equal(JSON.parse(toml[1]!.slice("command = ".length)), runtime.command);
  assert.deepEqual(JSON.parse(toml[2]!.slice("args = ".length)), runtime.args);
  assert(!toml.join("\n").includes("\u007f"), "TOML must escape the DEL control character");
  assert(toml.includes("startup_timeout_sec = 30"));
  assert(toml.includes("tool_timeout_sec = 120"));
  const argv = execFileSync(
    "/bin/sh",
    ["-c", `claude() { printf '%s\\0' "$@"; }; ${formatMcpConfig("claude-code", runtime)}`],
    { encoding: "utf8" },
  )
    .split("\0")
    .slice(0, -1);
  assert.deepEqual(argv, [
    "mcp",
    "add",
    "--transport",
    "stdio",
    "--scope",
    "user",
    product.mcpServerName,
    "--",
    runtime.command,
    ...runtime.args,
  ]);
});
