import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { ApplicationService } from "@/server/services/ApplicationService";
import { errorOf } from "@/server/contracts/validation";

test("first use offers recording or importing a video without creating a named project first", async ({
  page,
}, testInfo) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-first-use-ui-"));
  const video = path.join(root, "My first video.mp4");
  await fs.writeFile(video, "isolated import fixture");
  const methods: string[] = [];
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method) => {
      if (method === "media.inspect")
        return { durationMs: 6000, width: 1280, height: 720, fps: 30, hasAudio: true };
      if (method === "capabilities")
        return {
          permissions: {
            screen: true,
            input: true,
            camera: "authorized",
            microphone: "authorized",
          },
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
          sources: [
            { id: "screen", kind: "display", name: "Test display", width: 1280, height: 720 },
          ],
        };
      throw new Error(`Native call not used by browser workflow: ${method}`);
    },
  });
  await service.initialize();
  try {
    const { permissions } = z
      .object({ permissions: z.array(z.unknown()) })
      .parse(
        JSON.parse(
          await fs.readFile(
            new URL("../../src-tauri/capabilities/default.json", import.meta.url),
            "utf8",
          ),
        ),
      );
    expect(permissions).toContain("core:window:allow-start-dragging");
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
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:1421");
    // The overlay title bar must hit a real Tauri drag target, not a CSS pseudo-element.
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.elementFromPoint(400, 20)?.hasAttribute("data-tauri-drag-region"),
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Record screen", exact: true }).first(),
    ).toBeEnabled();
    await expect(page.getByRole("button", { name: "Open project", exact: true })).toBeVisible();

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Import video", exact: true }).first().click();
    expect(await service.store.list()).toHaveLength(0);
    page.once("dialog", (dialog) => dialog.accept(video));
    await page.getByRole("button", { name: "Import video", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Export video", exact: true })).toBeEnabled();
    await expect(page.locator("header.app-header")).toHaveAttribute(
      "data-tauri-drag-region",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "Export video", exact: true }),
    ).not.toHaveAttribute("data-tauri-drag-region");
    expect(methods).toContain("project.import");
    expect(methods).not.toContain("recording.start");
    expect(methods).not.toContain("project.create");
    const [project] = await service.store.list();
    expect(project.name).toBe("My first video");
    expect(project.durationMs).toBe(6000);
    await page.getByRole("button", { name: "Export video", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Choose location & export", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Back to projects", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath("start-actions.png") });

    await page.getByRole("button", { name: "Record screen", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Capture source", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start recording", exact: true })).toBeEnabled();
    await expect(page.getByLabel("Project name", { exact: true })).toHaveCount(0);
    expect(methods).not.toContain("recording.start");
    expect(await service.store.list()).toHaveLength(2);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
