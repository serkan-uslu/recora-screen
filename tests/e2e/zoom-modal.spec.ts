import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { ApplicationService } from "@/server/services/ApplicationService";
import { errorOf } from "@/server/contracts/validation";

test("zoom settings open without moving the list and contain editing shortcuts", async ({
  page,
}, testInfo) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-zoom-modal-"));
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method) => {
      throw new Error(`Native call not used in browser control test: ${method}`);
    },
  });
  await service.initialize();
  try {
    const created = await service.store.create("Zoom modal fixture");
    await fs.writeFile(
      path.join(service.store.dir(created.id), "media/screen.mov"),
      "isolated browser fixture",
    );
    await service.store.mutate(
      created.id,
      created.revision,
      (project) => {
        project.source = {
          durationMs: 150_000,
          width: 640,
          height: 360,
          fps: 30,
          screen: "media/screen.mov",
        };
        project.status = "ready";
        project.edits.segments = [{ startMs: 0, endMs: 150_000 }];
        project.edits.zooms = Array.from({ length: 48 }, (_, index) => ({
          id: `zoom-${index + 1}`,
          startMs: index * 3000,
          endMs: index * 3000 + 2000,
          scale: 1.7,
          x: 0.5,
          y: 0.5,
          followCursor: true,
          motion: "gentle",
        }));
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
    await page.getByRole("button", { name: "Open Zoom modal fixture" }).click();
    await page.getByRole("button", { name: "Zoom & cursor", exact: true }).click();
    const inspector = page.locator(".inspector-body");
    const zoomRow = page.locator(".zoom-list").getByRole("button", { name: /^Zoom 39 / });
    await zoomRow.scrollIntoViewIfNeeded();
    const scrollTop = () => inspector.evaluate((element) => element.scrollTop);
    const listPosition = await scrollTop();
    await zoomRow.click();
    const dialog = page.getByRole("dialog", { name: "Zoom settings", exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(scrollTop).toBe(listPosition);
    await expect(dialog.getByRole("spinbutton", { name: "Start (seconds)" })).toHaveValue("114");

    const before = await service.store.get(created.id);
    await dialog.getByRole("spinbutton", { name: "Start (seconds)" }).press("Backspace");
    await dialog.getByRole("spinbutton", { name: "Start (seconds)" }).fill("114");
    await dialog.evaluate((element) => element.focus());
    await expect(dialog).toBeFocused();
    await page.keyboard.press("s");
    await page.keyboard.press("Delete");
    await page.keyboard.press("Meta+z");
    await page.keyboard.press("Space");
    expect((await service.store.get(created.id)).revision).toBe(before.revision);
    expect((await service.store.get(created.id)).edits.zooms).toHaveLength(48);
    await expect(page.getByRole("button", { name: "Pause preview", exact: true })).toHaveCount(0);
    await dialog.getByRole("spinbutton", { name: "Start (seconds)" }).fill("114");

    await dialog.getByRole("combobox", { name: "Zoom motion", exact: true }).selectOption("snappy");
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.zooms[38]?.motion)
      .toBe("snappy");
    await expect(dialog.getByRole("combobox", { name: "Zoom motion", exact: true })).toBeEnabled();
    expect((await service.store.get(created.id)).edits.zooms[37]?.motion).toBe("gentle");
    await page.screenshot({ path: testInfo.outputPath("zoom-settings-modal.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect.poll(scrollTop).toBe(listPosition);
    await expect(zoomRow).toBeFocused();
    await expect(zoomRow).toHaveAttribute("aria-pressed", "true");

    await zoomRow.click();
    await dialog.getByRole("button", { name: "Remove zoom", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => (await service.store.get(created.id)).edits.zooms.length)
      .toBe(47);
    await expect.poll(scrollTop).toBe(listPosition);
    await expect(
      page.locator(".zoom-list").getByRole("button", { name: /^Zoom 39 / }),
    ).toBeInViewport();

    const timelineZoom = page.locator(".zoom-clip").first();
    await timelineZoom.click();
    await expect(dialog).toHaveCount(0);
    await timelineZoom.dblclick();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("spinbutton", { name: "Start (seconds)" })).toHaveValue("0");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
