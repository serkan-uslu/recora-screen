import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { errorOf } from "@/server/contracts/validation";
import { ApplicationService } from "@/server/services/ApplicationService";

test("settings and Keychain controls use the shared command service", async ({ page }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "recora-settings-ui-"));
  const keys = new Map<string, string>();
  const methods: string[] = [];
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method, params) => {
      const input = z
        .object({ provider: z.enum(["openai", "anthropic"]) })
        .passthrough()
        .safeParse(params);
      if (method === "capabilities")
        return {
          permissions: {
            screen: true,
            input: true,
            camera: "authorized",
            microphone: "authorized",
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
        };
      if (!input.success) throw new Error(`Missing provider for ${method}`);
      if (method === "keychain.get") return keys.get(input.data.provider) ?? "";
      if (method === "keychain.set") {
        keys.set(input.data.provider, z.object({ key: z.string() }).parse(params).key);
        return { ok: true };
      }
      if (method === "keychain.delete") {
        keys.delete(input.data.provider);
        return { ok: true };
      }
      throw new Error(`Native call not used by settings UI test: ${method}`);
    },
  });
  await service.initialize();
  const requestSchema = z.object({
    id: z.unknown().optional(),
    method: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
  });
  await page.route("**/api/command", async (route) => {
    const request = requestSchema.parse(route.request().postDataJSON());
    methods.push(request.method);
    try {
      await route.fulfill({
        json: { id: request.id, result: await service.command(request.method, request.params) },
      });
    } catch (error) {
      await route.fulfill({ json: { id: request.id, error: errorOf(error) } });
    }
  });

  try {
    await page.goto("http://127.0.0.1:1421");
    await page.getByRole("button", { name: "Settings & MCP", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Make yourself at home." });
    await dialog.locator('select[name="language"]').selectOption("tr");
    await page.getByRole("button", { name: "Save preferences", exact: true }).click();
    await expect.poll(async () => (await service.command("settings.get")).language).toBe("tr");

    const key = dialog.locator('input[type="password"]');
    await key.fill("sk-test-openai-key");
    await page.getByRole("button", { name: "Save key", exact: true }).click();
    await expect.poll(() => keys.get("openai")).toBe("sk-test-openai-key");
    await expect(key).toHaveAttribute("placeholder", "A key is saved in Keychain");
    await page.getByRole("button", { name: "Remove saved key", exact: true }).click();
    await expect.poll(() => keys.has("openai")).toBe(false);
    await expect(key).toHaveAttribute("placeholder", "Paste your API key");

    expect(methods).toContain("settings.update");
    expect(methods).toContain("keychain.set");
    expect(methods).toContain("keychain.delete");
  } finally {
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
