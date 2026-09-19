import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { ApplicationService } from "@/server/services/ApplicationService";
import { errorOf } from "@/server/contracts/validation";
import { duration } from "@/shared/timeline";

// Browser controls use the real command service in a disposable project. Native rendering has its own acceptance checks.
test("layers, imported audio, GIF controls and cursor/camera settings survive the editor workflow", async ({
  page,
}, testInfo) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-editor-ui-"));
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method) => {
      if (method === "audio.inspect") return { durationMs: 5000 };
      throw new Error(`Native call not used in browser control test: ${method}`);
    },
  });
  await service.initialize();
  try {
    const created = await service.store.create("Editor feature fixture");
    await fs.writeFile(
      path.join(service.store.dir(created.id), "media/screen.mov"),
      "isolated browser fixture",
    );
    await service.store.mutate(
      created.id,
      created.revision,
      (project) => {
        project.source = {
          durationMs: 3000,
          width: 640,
          height: 360,
          fps: 30,
          screen: "media/screen.mov",
        };
        project.status = "ready";
        project.edits.segments = [{ startMs: 0, endMs: 3000 }];
      },
      false,
    );
    const audio = path.join(root, "voice.wav");
    await fs.writeFile(audio, "isolated decoder fixture");
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
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:1421");
    await page.getByRole("button", { name: "Open Editor feature fixture" }).click();
    for (const name of [
      "Go to start",
      "Previous clip boundary",
      "Back 5 seconds",
      "Back 1 second",
      "Forward 1 second",
      "Forward 5 seconds",
      "Next clip boundary",
      "Go to end",
    ])
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Forward 1 second", exact: true }).click();
    await expect(page.locator(".playback-time")).toContainText("00:01");
    await page.getByText("Time range", { exact: true }).click();
    await page.getByRole("button", { name: "Select entire video", exact: true }).click();
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await page.getByRole("button", { name: "Add solid cover", exact: true }).click();
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.overlays[0]?.kind)
      .toBe("redact");
    await expect(page.getByRole("slider", { name: "Height", exact: true })).toBeVisible();
    await expect(page.getByLabel("Animation", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Add arrow", exact: true }).click();
    await expect(page.getByRole("slider", { name: "Arrow direction", exact: true })).toBeVisible();
    await page.getByRole("slider", { name: "Arrow direction", exact: true }).press("ArrowRight");
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.overlays[1]?.rotation)
      .toBe(15);
    await page.screenshot({ path: testInfo.outputPath("layers.png") });
    await page.getByRole("button", { name: "Audio", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept(audio));
    await page.getByRole("button", { name: "Add audio to selection", exact: true }).click();
    await expect(page.getByText("voice.wav", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Start (seconds)", { exact: true }).fill("0.5");
    await page.getByLabel("End (seconds)", { exact: true }).fill("2");
    await page.getByLabel("Skip into audio (seconds)", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Apply audio timing", exact: true }).click();
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.audioClips?.[0]?.offsetMs)
      .toBe(1000);
    await page.screenshot({ path: testInfo.outputPath("audio.png") });
    await page.getByRole("button", { name: "Camera", exact: true }).click();
    await page.getByRole("button", { name: "Video default", exact: true }).click();
    await page.getByText("Position and appearance details", { exact: true }).click();
    await page.getByRole("switch", { name: "Mirror camera", exact: true }).click();
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.camera.mirror)
      .toBe(true);
    await page.getByRole("switch", { name: "Shrink camera during zoom", exact: true }).click();
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.camera.zoomReactive)
      .toBe(true);
    await page.getByRole("button", { name: "Zoom & cursor", exact: true }).click();
    await page.getByText("Cursor effects and style", { exact: true }).click();
    for (const label of ["Cursor motion blur", "Click bounce", "Cursor sway", "Loop cursor path"]) {
      await page.getByRole("switch", { name: label, exact: true }).click();
      await expect(page.getByRole("switch", { name: label, exact: true })).toBeChecked();
    }
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.cursor.loop)
      .toBe(true);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page.getByRole("combobox", { name: "Format", exact: true }).selectOption("gif");
    await page.getByRole("combobox", { name: "GIF frame rate", exact: true }).selectOption("25");
    await page.getByLabel("Loop continuously", { exact: true }).uncheck();
    await expect(page.getByText("GIF · no audio", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose location & export" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("gif.png") });
    await page.getByRole("button", { name: "Back to projects", exact: true }).click();
    await page.getByRole("button", { name: "Open Editor feature fixture" }).click();
    const reopened = await service.store.get(created.id);
    expect(reopened.edits.overlays).toHaveLength(2);
    expect(reopened.edits.audioClips).toHaveLength(1);
    expect(reopened.edits.cursor.loop).toBe(true);
    expect(reopened.edits.camera.mirror).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("recording clips can be split, moved, deleted and joined with imported video and images", async ({
  page,
}, testInfo) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-timeline-ui-"));
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method) => {
      if (method === "media.inspect") return { durationMs: 2000, width: 640, height: 360 };
      throw new Error(`Native call not used in browser control test: ${method}`);
    },
  });
  await service.initialize();
  try {
    const created = await service.store.create("Timeline fixture");
    await fs.writeFile(
      path.join(service.store.dir(created.id), "media/screen.mov"),
      "isolated browser fixture",
    );
    await service.store.mutate(
      created.id,
      created.revision,
      (project) => {
        project.source = {
          durationMs: 6000,
          width: 640,
          height: 360,
          fps: 30,
          screen: "media/screen.mov",
          camera: "media/screen.mov",
          microphone: "media/screen.mov",
        };
        project.status = "ready";
        project.edits.segments = [{ startMs: 0, endMs: 6000 }];
        project.transcript = [
          {
            id: "sentence",
            startMs: 0,
            endMs: 4000,
            text: "A sentence interrupted by inserted media.",
          },
        ];
      },
      false,
    );
    const video = path.join(root, "demo.mp4"),
      image = path.join(root, "title.png");
    await fs.writeFile(video, "isolated decoder fixture");
    await fs.writeFile(
      image,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
        "base64",
      ),
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
    const clips = async () => (await service.store.get(created.id)).edits.segments;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:1421");
    await page.getByRole("button", { name: "Open Timeline fixture" }).click();
    const ruler = page.getByRole("slider", { name: "Timeline position", exact: true });
    await ruler.press("Shift+ArrowRight");
    await ruler.press("Shift+ArrowRight");
    page.once("dialog", (dialog) => dialog.accept(video));
    await page
      .getByRole("combobox", { name: "Add media at playhead", exact: true })
      .selectOption("video");
    await expect.poll(async () => (await clips()).length).toBe(3);
    const assetId = (await clips())[1]!.assetId;
    expect(assetId).toBeTruthy();
    expect(await clips()).toEqual([
      { startMs: 0, endMs: 2000 },
      { startMs: 0, endMs: 2000, assetId },
      { startMs: 2000, endMs: 6000 },
    ]);
    await expect(page.getByRole("button", { name: "Add zoom", exact: true })).toBeDisabled();
    await expect(page.locator(".camera-clip")).toHaveCount(2);
    await expect(page.locator(".audio-clip")).toHaveCount(3);
    expect(
      await page
        .locator(".camera-clip")
        .first()
        .evaluate((element) => element.style.width),
    ).toBe("25%");
    await page.getByRole("button", { name: "Captions", exact: true }).click();
    await page.getByRole("button", { name: "Cut this sentence", exact: true }).click();
    await expect.poll(async () => (await clips()).length).toBe(2);
    expect(await clips()).toEqual([
      { startMs: 0, endMs: 2000, assetId },
      { startMs: 4000, endMs: 6000 },
    ]);
    await page.keyboard.press("Meta+z");
    await expect.poll(async () => (await clips()).length).toBe(3);
    await ruler.press("Shift+ArrowRight");
    await page.getByRole("button", { name: "Split video", exact: true }).click();
    await expect.poll(async () => (await clips()).length).toBe(4);
    await page.locator(".screen-clip").nth(1).click({ button: "right" });
    await page
      .getByRole("dialog", { name: /Clip \d+ actions/ })
      .getByRole("button", { name: "Move earlier", exact: true })
      .click();
    await expect.poll(async () => (await clips())[0]?.assetId).toBe(assetId);
    await page.locator(".screen-clip").first().click({ button: "right" });
    await page
      .getByRole("dialog", { name: /Clip \d+ actions/ })
      .getByRole("combobox", { name: "Clip position", exact: true })
      .selectOption("3");
    await expect.poll(async () => (await clips())[3]?.startMs).toBe(0);
    expect((await clips())[3]?.assetId).toBe(assetId);
    await page.locator(".screen-clip").nth(1).click({ button: "right" });
    await page
      .getByRole("dialog", { name: /Clip \d+ actions/ })
      .getByRole("button", { name: "Delete clip", exact: true })
      .click();
    await expect.poll(async () => (await clips()).length).toBe(3);
    expect((await clips()).filter((segment) => segment.assetId === assetId)).toEqual([
      { startMs: 0, endMs: 1000, assetId },
    ]);
    await page.keyboard.press("Meta+z");
    await expect.poll(async () => (await clips()).length).toBe(4);
    await page.getByRole("button", { name: "Go to end", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept(image));
    await page
      .getByRole("combobox", { name: "Add media at playhead", exact: true })
      .selectOption("image");
    await expect.poll(async () => (await clips()).length).toBe(5);
    const still = (await clips())[4]!;
    expect(still.endMs).toBe(3000);
    await page.locator(".screen-clip").last().click({ button: "right" });
    await page
      .getByRole("dialog", { name: /Clip \d+ actions/ })
      .getByRole("spinbutton", { name: "Clip source end in seconds", exact: true })
      .fill("5");
    await page
      .getByRole("dialog", { name: /Clip \d+ actions/ })
      .getByRole("button", { name: "Apply trim", exact: true })
      .click();
    await expect.poll(async () => (await clips())[4]?.endMs).toBe(5000);
    await page.locator(".screen-clip").last().click({ button: "right" });
    await page
      .getByRole("dialog", { name: /Clip \d+ actions/ })
      .getByRole("button", { name: "Move earlier", exact: true })
      .click();
    await expect.poll(async () => (await clips())[3]?.assetId).toBe(still.assetId);
    await page.locator(".screen-clip").nth(2).click({ button: "right" });
    await page
      .getByRole("dialog", { name: /Clip \d+ actions/ })
      .getByRole("button", { name: "Delete clip", exact: true })
      .click();
    await expect.poll(async () => (await clips()).length).toBe(4);
    await page.getByRole("button", { name: "Go to start", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Restore deleted footage at playhead", exact: true })
      .selectOption("0");
    await expect.poll(async () => (await clips())[0]?.startMs).toBe(2000);
    expect((await clips())[0]?.endMs).toBe(6000);
    await expect(
      page.getByRole("combobox", { name: "Restore deleted footage at playhead", exact: true }),
    ).toHaveCount(0);
    const beforeReopen = await clips();
    expect(duration(beforeReopen)).toBe(13000);
    await page.screenshot({ path: testInfo.outputPath("timeline-media.png") });
    await page.getByRole("button", { name: "Back to projects", exact: true }).click();
    await page.getByRole("button", { name: "Open Timeline fixture" }).click();
    expect(await clips()).toEqual(beforeReopen);
    await expect(page.locator(".screen-clip")).toHaveCount(5);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
