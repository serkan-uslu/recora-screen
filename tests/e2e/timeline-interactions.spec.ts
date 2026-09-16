import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { ApplicationService } from "@/server/services/ApplicationService";
import { errorOf } from "@/server/contracts/validation";

test("timeline selection, keyboard deletion and resizing keep the editor stable", async ({
  page,
}, testInfo) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-timeline-interactions-"));
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method) => {
      throw new Error(`Native call not used in browser control test: ${method}`);
    },
  });
  await service.initialize();
  try {
    const created = await service.store.create("Timeline interaction fixture");
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
        project.edits.segments = [
          { startMs: 0, endMs: 5000 },
          { startMs: 5000, endMs: 10_000 },
        ];
        project.edits.zooms = [
          { id: "zoom", startMs: 1000, endMs: 2500, scale: 1.7, x: 0.5, y: 0.5 },
        ];
        project.edits.overlays = [
          {
            id: "overlay",
            startMs: 6000,
            endMs: 8000,
            kind: "text",
            text: "Private region",
            x: 0.5,
            y: 0.5,
            width: 0.4,
            fontSize: 24,
            color: "#ffffff",
            animation: "none",
          },
        ];
        project.assets = [
          {
            id: "voice",
            kind: "audio",
            name: "voice.wav",
            path: "media/screen.mov",
            durationMs: 5000,
          },
        ];
        project.edits.audioClips = [
          { id: "audio", assetId: "voice", startMs: 500, endMs: 1500, offsetMs: 0, volume: 1 },
        ];
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
    const undo = page.getByRole("button", { name: "Undo (⌘Z)", exact: true });
    const selectionStart = page.locator('input[aria-label="Selection start in seconds"]');
    const selectionEnd = page.locator('input[aria-label="Selection end in seconds"]');
    const zoom = page.getByRole("button", { name: "Edit 1.7 times zoom", exact: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:1421");
    await page.getByRole("button", { name: "Open Timeline interaction fixture" }).click();
    const ruler = page.locator(".timeline-ruler");
    const rulerTop = await ruler.evaluate((element) => element.getBoundingClientRect().top);

    await page.getByRole("button", { name: "Screen clip 2, 1 times speed", exact: true }).click();
    await expect(selectionStart).toHaveValue("5.00");
    await expect(selectionEnd).toHaveValue("10.00");
    await expect(page.getByRole("button", { name: "Move earlier", exact: true })).toBeVisible();
    await expect(page.locator(".inspector-title")).toHaveText("Video clip");
    await expect(page.locator(".timeline-selection")).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Video speed for selected time range" })
      .selectOption("2");
    await expect(
      page.getByRole("button", { name: "Screen clip 2, 2 times speed", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await undo.click();
    await expect(
      page.getByRole("button", { name: "Screen clip 2, 1 times speed", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await ruler.press("Shift+ArrowRight");
    await expect(page.getByRole("button", { name: "Split here", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Split here", exact: true }).click();
    await expect
      .poll(async () => (await project()).edits.segments)
      .toEqual([
        { startMs: 0, endMs: 5000 },
        { startMs: 5000, endMs: 6000 },
        { startMs: 6000, endMs: 10000 },
      ]);
    await undo.click();
    await expect.poll(async () => (await project()).edits.segments.length).toBe(2);
    await page.getByRole("button", { name: "Screen clip 2, 1 times speed", exact: true }).click();
    await page.locator(".timeline").focus();
    expect(await ruler.evaluate((element) => element.getBoundingClientRect().top)).toBe(rulerTop);
    await page.keyboard.press("Backspace");
    await expect
      .poll(async () => (await project()).edits.segments)
      .toEqual([{ startMs: 0, endMs: 5000 }]);
    await undo.click();
    await expect.poll(async () => (await project()).edits.segments.length).toBe(2);

    await page
      .getByRole("button", { name: "Camera clip 2", exact: true })
      .click({ position: { x: 32, y: 10 } });
    await expect(selectionStart).toHaveValue("5.00");
    await expect(selectionEnd).toHaveValue("10.00");
    await expect(page.getByRole("button", { name: "Keep only this range" })).toBeDisabled();
    await expect(
      page.getByRole("combobox", { name: "Video speed for selected time range" }),
    ).toBeDisabled();
    await page.getByText("Position and appearance details", { exact: true }).click();
    await page.getByRole("switch", { name: "Mirror camera", exact: true }).click();
    await expect(page.getByRole("button", { name: "Camera clip 2", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("switch", { name: "Mirror camera", exact: true })).toBeChecked();
    await expect(page.getByRole("button", { name: "Hide camera clip", exact: true })).toBeEnabled();
    await page.locator(".native-preview").focus();
    await page.keyboard.press("Delete");
    await expect
      .poll(async () => (await project()).edits.camera.hiddenRanges)
      .toEqual([{ startMs: 5000, endMs: 10_000 }]);
    expect((await project()).edits.segments).toHaveLength(2);
    await page
      .getByRole("button", { name: "Camera clip 2", exact: true })
      .click({ position: { x: 32, y: 10 } });
    await expect(page.getByRole("button", { name: "Camera clip 2", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await undo.click();
    await expect.poll(async () => (await project()).edits.camera.hiddenRanges).toEqual([]);

    await zoom.click();
    await expect(page.getByRole("button", { name: "Delete zoom", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Keep only this range" })).toBeDisabled();
    await expect(
      page.getByRole("combobox", { name: "Video speed for selected time range" }),
    ).toBeDisabled();
    await expect(page.locator(".timeline-selection")).toHaveCount(0);
    await page.getByText("Time range", { exact: true }).click();
    await selectionStart.press("Backspace");
    await page.getByText("Time range", { exact: true }).click();
    expect((await project()).edits.zooms).toHaveLength(1);
    await zoom.click();
    await page.keyboard.press("Control+Backspace");
    expect((await project()).edits.zooms).toHaveLength(1);
    await page.getByRole("button", { name: "Export video", exact: true }).click();
    await page.keyboard.press("Delete");
    expect((await project()).edits.zooms).toHaveLength(1);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await zoom.click();
    await page.keyboard.press("Delete");
    await expect.poll(async () => (await project()).edits.zooms).toEqual([]);
    expect((await project()).edits.segments).toHaveLength(2);
    await undo.click();
    await expect.poll(async () => (await project()).edits.zooms.length).toBe(1);

    await page.locator(".overlay-clip").filter({ hasText: "Private region" }).click();
    await page.keyboard.press("Backspace");
    await expect.poll(async () => (await project()).edits.overlays).toEqual([]);
    await undo.click();
    await expect.poll(async () => (await project()).edits.overlays.length).toBe(1);
    await page.locator(".audio-clip").filter({ hasText: "voice.wav" }).click();
    await expect(page.locator(".inspector-title")).toHaveText("Audio");
    await expect(page.getByRole("slider", { name: "Clip volume", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete audio clip", exact: true }),
    ).toBeEnabled();
    await page.keyboard.press("Delete");
    await expect.poll(async () => (await project()).edits.audioClips).toEqual([]);
    await undo.click();
    await expect.poll(async () => (await project()).edits.audioClips?.length).toBe(1);

    await zoom.click();
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    expect(await ruler.evaluate((element) => element.getBoundingClientRect().top)).toBe(rulerTop);
    const screen = await page.locator(".screen-track").boundingBox();
    if (!screen) throw new Error("Video track is not visible");
    await page.keyboard.down("Shift");
    await page.mouse.move(screen.x + screen.width * 0.1, screen.y + screen.height / 2);
    await page.mouse.down();
    await page.mouse.move(screen.x + screen.width * 0.7, screen.y + screen.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    expect(Number(await selectionStart.inputValue())).toBeCloseTo(1, 1);
    expect(Number(await selectionEnd.inputValue())).toBeCloseTo(7, 1);
    expect((await project()).edits.segments).toHaveLength(2);
    const selectedStartMs = Number(await selectionStart.inputValue()) * 1000;
    const selectedEndMs = Number(await selectionEnd.inputValue()) * 1000;
    await page.keyboard.press("Delete");
    await expect
      .poll(async () => (await project()).edits.segments)
      .toEqual([
        { startMs: 0, endMs: expect.closeTo(selectedStartMs, -1) },
        { startMs: expect.closeTo(selectedEndMs, -1), endMs: 10_000 },
      ]);
    await undo.click();
    await expect
      .poll(async () => (await project()).edits.segments)
      .toEqual([
        { startMs: 0, endMs: 5000 },
        { startMs: 5000, endMs: 10_000 },
      ]);

    const timeline = page.locator(".timeline");
    const separator = page.getByRole("separator", { name: "Resize timeline", exact: true });
    const height = () => timeline.evaluate((element) => element.getBoundingClientRect().height);
    const originalHeight = await height();
    const handle = await separator.boundingBox();
    if (!handle) throw new Error("Timeline resize handle is not visible");
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - 100, {
      steps: 8,
    });
    await page.mouse.up();
    await expect.poll(height).toBeGreaterThan(originalHeight + 90);
    const resizedHeight = await height();
    await separator.press("ArrowUp");
    await expect.poll(height).toBeGreaterThan(resizedHeight);
    await separator.press("ArrowDown");
    await expect.poll(height).toBe(resizedHeight);
    const movedHandle = await separator.boundingBox();
    if (!movedHandle) throw new Error("Timeline resize handle is not visible");
    await page.mouse.move(
      movedHandle.x + movedHandle.width / 2,
      movedHandle.y + movedHandle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(movedHandle.x + movedHandle.width / 2, movedHandle.y - 50, { steps: 4 });
    await expect.poll(height).toBeGreaterThan(resizedHeight);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect.poll(height).toBe(resizedHeight);
    const status = await page.locator(".editor-status").boundingBox();
    if (!status) throw new Error("Editor status is not visible");
    expect(status.y + status.height).toBeLessThanOrEqual(1000);
    expect(
      await timeline.evaluate((element) => element.getBoundingClientRect().bottom),
    ).toBeLessThanOrEqual(status.y);
    await page.screenshot({ path: testInfo.outputPath("timeline-interactions.png") });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
