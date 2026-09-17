import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type TextContent,
  type ImageContent,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";
import { AppClient } from "@/server/infrastructure/rpc.js";
import { AppError, errorOf, object } from "@/server/contracts/validation.js";
import { commandRegistry, mcpPermissionCategory, mcpPermissionsSchema } from "@/server/service.js";
import { product } from "@/shared/brand.js";
import { defaultMcpPermissions } from "@/shared/types.js";

export const toolMethods = Object.fromEntries(
  Object.keys(commandRegistry).map((method) => [method.replace(/[./]/g, "_"), method]),
);
export async function callAppTool(
  call: (method: string, params: Record<string, unknown>) => Promise<unknown>,
  name: string,
  args: Record<string, unknown>,
) {
  const method = toolMethods[name];
  if (!method) throw new Error(`Unknown tool: ${name}`);
  return call(method, args);
}

export function assertMcpPermission(method: string, settings: unknown) {
  const raw = object(settings).mcpPermissions;
  const permissions = raw ? mcpPermissionsSchema.parse(raw) : defaultMcpPermissions;
  const category = mcpPermissionCategory(method);
  if (!permissions[category])
    throw new AppError(
      "MCP_PERMISSION_DENIED",
      `MCP ${category} commands are disabled. Enable ${category} access in Settings > MCP & shortcuts.`,
    );
}
export function createMcpServer(
  call: (method: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  const server = new Server(
    { name: product.mcpServerName, version: product.version },
    {
      capabilities: { tools: {} },
      instructions:
        "Control the running Recora Screen desktop app. Read project_open before editing. Timed edits use CURRENT OUTPUT timeline milliseconds, except clip.trim sourceStartMs/sourceEndMs and source.restore startMs/endMs explicitly use SOURCE time. Persisted annotations use SOURCE time. timeline_apply batches are atomic and undoable; use expectedRevision from the latest project. For multiple cuts, work backwards. Start recording only at user request; operating-system capture permissions still require the user. Long AI/export operations return job IDs: poll jobs_get, cancel with jobs_cancel. Pass a unique requestId on mutations and reuse it for retries in the same app session. Never edit project files directly.",
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(toolMethods).map(([name, method]) => {
      const metadata = commandRegistry[method]!;
      const schema = z.toJSONSchema(metadata.schema, { unrepresentable: "any" });
      delete schema.$schema;
      schema.properties = {
        ...schema.properties,
        requestId: {
          type: "string",
          description:
            "Optional unique retry ID. Reuse for the same mutation if its response was lost.",
        },
      };
      return {
        name,
        description: `${method}: ${metadata.description} Examples: ${metadata.examples.join("; ")}`,
        inputSchema: { ...schema, type: "object" as const },
        annotations: {
          readOnlyHint: metadata.readOnly,
          destructiveHint: metadata.destructive,
          idempotentHint: metadata.readOnly,
          openWorldHint: method.startsWith("ai.") || method.startsWith("keychain."),
        },
      };
    }),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const method = toolMethods[request.params.name];
      if (!method) throw new Error(`Unknown tool: ${request.params.name}`);
      assertMcpPermission(method, await call("settings.get", {}));
      const result = await callAppTool(call, request.params.name, request.params.arguments ?? {});
      const content: (TextContent | ImageContent)[] = [
        { type: "text", text: JSON.stringify(result) ?? "null" },
      ];
      if (
        toolMethods[request.params.name] === "preview.frame" &&
        result &&
        typeof result === "object" &&
        "path" in result &&
        typeof result.path === "string"
      )
        content.push({
          type: "image",
          mimeType: "image/png",
          data: (await fs.readFile(result.path)).toString("base64"),
        });
      return { content, structuredContent: { result: result ?? null } };
    } catch (error) {
      const value = errorOf(error);
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(value) }],
        structuredContent: { error: value },
      };
    }
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const client = new AppClient();
  const server = createMcpServer((method, params) => client.call(method, params));
  process.stdin.on("end", () => client.close());
  await server.connect(new StdioServerTransport());
}
