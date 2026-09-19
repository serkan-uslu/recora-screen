import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { ApplicationService } from "@/server/services/ApplicationService";
import { errorOf } from "@/server/contracts/validation";
import { cameraAt } from "@/shared/camera";

test("split camera clips retain separate appearance and visibility through reload and undo", async ({
  page,
}) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-split-camera-"));
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method) => {
      throw new Error(`Native call not used in browser control test: ${method}`);
    },
  });
  await service.initialize();
  try {
    const created = await service.store.create("Split camera fixture");
    await fs.writeFile(
      path.join(service.store.dir(created.id), "media/screen.mov"),
      "isolated browser fixture",
    );
    await service.store.mutate(
      created.id,
      created.revision,
      (project) => {
        project.source = {
          durationMs: 10_000,
          width: 640,
          height: 360,
          fps: 30,
          screen: "media/screen.mov",
          camera: "media/screen.mov",
        };
        project.status = "ready";
        project.edits.segments = [{ startMs: 0, endMs: 10_000 }];
      },
      false,
    );
    const requestSchema = z.object({
      id: z.unknown().optional(),
      method: z.string(),
      params: z.record(z.string(), z.unknown()).optional(),
    });
    await page.route("**/api/command", async (route) => {
      const request = requestSchema.parse(route.request().postDataJSON());
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
    const project = () => service.store.get(created.id);
    const second = page.getByRole("button", { name: "Camera clip 2", exact: true });
    const shown = page.getByRole("switch", { name: "Show camera in this selection", exact: true });
    const mirror = page.getByRole("switch", { name: "Mirror camera", exact: true });
    const undo = () => page.keyboard.press("Meta+z");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:1421");
    await page.getByRole("button", { name: "Open Split camera fixture" }).click();
    const ruler = page.getByRole("slider", { name: "Timeline position", exact: true });
    for (let i = 0; i < 5; i++) await ruler.press("Shift+ArrowRight");
    await page.getByRole("button", { name: "Split video", exact: true }).click();
    await expect.poll(async () => (await project()).edits.segments.length).toBe(2);
    await second.click({ position: { x: 32, y: 10 } });
    await page.getByRole("button", { name: "Square", exact: true }).click();
    await expect.poll(async () => cameraAt(await project(), 7500).shape).toBe("square");
    await page.getByText("Position and appearance details", { exact: true }).click();
    await mirror.click();
    await expect(mirror).toBeChecked();
    await shown.click();
    await expect
      .poll(async () => (await project()).edits.camera.hiddenRanges)
      .toEqual([{ startMs: 5000, endMs: 10_000 }]);
    await page.getByRole("button", { name: "Camera clip 1", exact: true }).click();
    await expect(page.getByRole("button", { name: "Circle", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(mirror).not.toBeChecked();
    await expect(shown).toBeChecked();

    await page.reload();
    await page.getByRole("button", { name: "Open Split camera fixture" }).click();
    await second.click({ position: { x: 32, y: 10 } });
    await expect(page.getByRole("button", { name: "Square", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByText("Position and appearance details", { exact: true }).click();
    await expect(mirror).toBeChecked();
    await expect(shown).not.toBeChecked();
    await undo();
    await expect(shown).toBeChecked();
    expect(cameraAt(await project(), 2500).shape).toBe("circle");
    expect(cameraAt(await project(), 7500).mirror).toBe(true);

    await page.getByRole("button", { name: "Video default", exact: true }).click();
    await page.getByRole("switch", { name: "Enable camera track", exact: true }).click();
    await expect.poll(async () => (await project()).edits.camera.visible).toBe(false);
    await second.click({ position: { x: 32, y: 10 } });
    await shown.click();
    await expect
      .poll(async () => (await project()).edits.camera.hiddenRanges)
      .toEqual([{ startMs: 0, endMs: 5000 }]);
    expect((await project()).edits.camera.visible).toBe(true);
    await undo();
    await expect.poll(async () => (await project()).edits.camera.visible).toBe(false);
    expect((await project()).edits.camera.hiddenRanges).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
