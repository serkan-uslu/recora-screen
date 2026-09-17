import { expect, test } from "@playwright/test";
import { z } from "zod";
import { mcpPermissionsSchema } from "@/server/service";
import { defaultMcpPermissions } from "@/shared/types";

test("MCP setup blocks temporary app paths until Recora Screen is installed", async ({ page }) => {
  let resources = "/Volumes/Recora Screen/Recora Screen.app/Contents/Resources";
  let mcpPermissions = { ...defaultMcpPermissions };
  const requestSchema = z.object({
    id: z.unknown().optional(),
    method: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
  });
  await page.route("**/api/command", async (route) => {
    const request = requestSchema.parse(route.request().postDataJSON());
    if (request.method === "settings.update")
      mcpPermissions = mcpPermissionsSchema.parse(request.params?.mcpPermissions);
    const result =
      request.method === "project.list" || request.method === "jobs.list"
        ? []
        : request.method === "settings.get"
          ? {
              provider: "openai",
              openaiModel: "gpt-5-mini",
              anthropicModel: "claude-sonnet-4-6",
              transcriptionModel: "small",
              language: "auto",
              hasOpenaiKey: false,
              hasAnthropicKey: false,
              mcpPermissions,
            }
          : request.method === "settings.update"
            ? { mcpPermissions }
            : request.method === "ai.models/list"
              ? []
              : request.method === "app.capabilities"
                ? {
                    nativeAvailable: true,
                    permissions: {
                      screen: true,
                      camera: "authorized",
                      microphone: "authorized",
                      input: true,
                    },
                    sources: [],
                    cameras: [],
                    microphones: [],
                    recording: {
                      active: false,
                      paused: false,
                      durationMs: 0,
                      microphoneLevel: 0,
                      systemLevel: 0,
                      cameraVisible: false,
                      cameraEnabled: false,
                    },
                    mcp: {
                      command: `${resources}/bin/node`,
                      args: [`${resources}/mcp.mjs`],
                    },
                  }
                : null;
    await route.fulfill({ json: { id: request.id, result } });
  });

  const openMcpSettings = async () => {
    await expect(
      page.getByRole("button", { name: "Record screen", exact: true }).first(),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Settings & MCP", exact: true }).click();
    await page.getByRole("button", { name: "MCP & shortcuts", exact: true }).click();
  };
  const expectInstallRequired = async () => {
    await expect(page.getByRole("alert")).toContainText("move Recora Screen to /Applications");
    await expect(
      page.getByRole("button", { name: "Install in Applications first", exact: true }),
    ).toBeDisabled();
    await expect(page.locator("pre.config-example")).toHaveCount(0);
  };

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:1421");
  await openMcpSettings();
  await expectInstallRequired();

  resources =
    "/private/var/folders/ab/cd/T/AppTranslocation/123/d/Recora Screen.app/Contents/Resources";
  await page.reload();
  await openMcpSettings();
  await expectInstallRequired();

  resources = "/Applications/Recora Screen.app/Contents/Resources";
  await page.reload();
  await openMcpSettings();
  await expect(page.locator("pre.config-example")).toContainText(resources);
  await expect(
    page.getByRole("button", { name: "Copy MCP configuration", exact: true }),
  ).toBeEnabled();
  await page.getByRole("switch", { name: "Control screen recording", exact: true }).click();
  await page
    .getByRole("switch", {
      name: "Use cloud AI, Keychain and permission prompts",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Save MCP access", exact: true }).click();
  await expect.poll(() => mcpPermissions.recording).toBe(true);
  await expect.poll(() => mcpPermissions.sensitive).toBe(true);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await openMcpSettings();
  await expect(
    page.getByRole("switch", { name: "Control screen recording", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", {
      name: "Use cloud AI, Keychain and permission prompts",
      exact: true,
    }),
  ).toBeChecked();
});
