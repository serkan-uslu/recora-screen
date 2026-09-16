import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { ApplicationService } from "@/server/services/ApplicationService";
import { errorOf } from "@/server/contracts/validation";

// Native acceptance tests decode real fixtures; this test verifies their responses map into the actual editor.
test("filmstrips and waveforms follow source trims, speed, reorder and decoding failures", async ({
  page,
}, testInfo) => {
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 54;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#eaf0f5";
    context.fillRect(0, 0, 96, 54);
    context.fillStyle = "#24779d";
    context.fillRect(15, 12, 40, 30);
    return canvas.toDataURL("image/jpeg");
  });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-timeline-media-ui-"));
  const sampleSchema = z.object({ path: z.string(), startMs: z.number(), endMs: z.number() });
  const calls: { method: string; path: string; startMs: number; endMs: number }[] = [];
  let failImported = false;
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method, params) => {
      if (method !== "media.filmstrip" && method !== "media.waveform")
        throw new Error("Native playback is covered separately");
      const sample = sampleSchema.parse(params);
      calls.push({ method, ...sample });
      if (failImported && sample.path.endsWith("import.mp4"))
        throw new Error("Fixture decoder unavailable");
      if (method === "media.waveform")
        return Array.from({ length: 256 }, (_, index) =>
          index % 64 < 16 ? 0 : 0.08 + (index % 16) / 60,
        );
      return Array.from({ length: 8 }, (_, index) => ({
        timeMs: sample.startMs + ((sample.endMs - sample.startMs) * (index + 0.5)) / 8,
        src: jpeg,
      }));
    },
  });
  await service.initialize();
  try {
    const created = await service.store.create("Timeline media fixture");
    for (const file of ["screen.mov", "microphone.wav", "import.mp4", "music.wav"])
      await fs.writeFile(
        path.join(service.store.dir(created.id), "media", file),
        "isolated native mock fixture",
      );
    await service.store.mutate(
      created.id,
      created.revision,
      (project) => {
        project.source = {
          screen: "media/screen.mov",
          microphone: "media/microphone.wav",
          durationMs: 8000,
          width: 640,
          height: 360,
          fps: 30,
        };
        project.status = "ready";
        project.assets = [
          {
            id: "insert",
            kind: "video",
            name: "Imported video",
            path: "media/import.mp4",
            durationMs: 4000,
            width: 640,
            height: 360,
          },
          { id: "music", kind: "audio", name: "Music", path: "media/music.wav", durationMs: 5000 },
        ];
        project.edits.segments = [
          { startMs: 4000, endMs: 6000, speed: 2 },
          { startMs: 1000, endMs: 3000, speed: 0.5, assetId: "insert" },
          { startMs: 0, endMs: 2000 },
        ];
        project.edits.audioClips = [
          { id: "music", assetId: "music", startMs: 500, endMs: 1500, offsetMs: 750, volume: 0.6 },
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
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:1421");
    await page.getByRole("button", { name: "Open Timeline media fixture" }).click();
    const clips = page.locator(".screen-clip");
    await expect(clips).toHaveCount(3);
    for (let index = 0; index < 3; index++)
      await expect(clips.nth(index).locator(".timeline-filmstrip img").first()).toBeVisible();
    await expect(page.locator(".timeline-waveform svg")).toHaveCount(4);
    expect(
      await clips
        .first()
        .locator("img")
        .first()
        .evaluate((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
    ).toBe(true);
    expect(
      calls
        .filter((call) => call.path.endsWith("screen.mov") && call.method === "media.filmstrip")
        .map((call) => [call.startMs, call.endMs])
        .sort(),
    ).toEqual([
      [0, 2000],
      [4000, 6000],
    ]);
    expect(
      calls.find((call) => call.path.endsWith("import.mp4") && call.method === "media.waveform"),
    ).toMatchObject({ startMs: 1000, endMs: 3000 });
    expect(calls.find((call) => call.path.endsWith("music.wav"))).toMatchObject({
      startMs: 750,
      endMs: 1750,
    });
    await page.screenshot({ path: testInfo.outputPath("filmstrip-waveform.png") });
    await clips.first().click({ button: "right" });
    let menu = page.getByRole("dialog", { name: "Clip 1 actions" });
    await menu.getByRole("spinbutton", { name: "Clip source start in seconds" }).fill("4.5");
    await menu.getByRole("spinbutton", { name: "Clip source end in seconds" }).fill("5.5");
    await menu.getByRole("button", { name: "Apply trim" }).click();
    await expect
      .poll(() =>
        calls.some(
          (call) =>
            call.path.endsWith("screen.mov") && call.startMs === 4500 && call.endMs === 5500,
        ),
      )
      .toBe(true);
    await expect(clips.first().locator(".timeline-filmstrip img").first()).toBeVisible();
    await expect(page.locator(".timeline-waveform svg")).toHaveCount(4);
    const sampleCount = calls.length;
    await clips.first().click({ button: "right" });
    menu = page.getByRole("dialog", { name: "Clip 1 actions" });
    await menu.getByRole("combobox", { name: "Playback speed" }).selectOption("1");
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.segments[0]?.speed ?? 1)
      .toBe(1);
    await clips.nth(1).click({ button: "right" });
    await page
      .getByRole("dialog", { name: "Clip 2 actions" })
      .getByRole("button", { name: "Move earlier" })
      .click();
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.segments[0]?.assetId)
      .toBe("insert");
    await expect(clips.first().locator(".timeline-filmstrip img").first()).toBeVisible();
    const timestamps = await clips
      .first()
      .locator(".timeline-filmstrip img")
      .evaluateAll((images) => images.map((image) => Number(image.getAttribute("data-source-ms"))));
    expect(timestamps.every((time) => time >= 1000 && time < 3000)).toBe(true);
    expect(calls.length).toBe(sampleCount);
    failImported = true;
    await clips.first().click({ button: "right" });
    menu = page.getByRole("dialog", { name: "Clip 1 actions" });
    await menu.getByRole("spinbutton", { name: "Clip source start in seconds" }).fill("1.25");
    await menu.getByRole("spinbutton", { name: "Clip source end in seconds" }).fill("2.75");
    await menu.getByRole("button", { name: "Apply trim" }).click();
    await expect(clips.first().locator(".timeline-filmstrip")).toHaveAttribute(
      "title",
      "Thumbnails unavailable",
    );
    await expect(clips.first().locator(".timeline-filmstrip img")).toHaveCount(0);
    await expect(
      page
        .getByRole("button", { name: "Video audio clip 1", exact: true })
        .locator(".timeline-waveform"),
    ).toHaveAttribute("title", "Waveform unavailable");
    await expect(
      page
        .getByRole("button", { name: "Video audio clip 1", exact: true })
        .locator(".timeline-waveform svg"),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
