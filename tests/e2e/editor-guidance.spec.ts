import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { ApplicationService } from "@/server/services/ApplicationService";
import { errorOf } from "@/server/contracts/validation";

test("editor explains first steps and reports actual project saves including failures", async ({
  page,
}) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenrec-guidance-"));
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async () => {
      throw new Error("No native media in this UI fixture");
    },
  });
  await service.initialize();
  let releaseSave = () => {};
  let delaySave = false;
  let failSave = false;
  try {
    const created = await service.store.create("First edit fixture");
    await fs.writeFile(
      path.join(service.store.dir(created.id), "media/screen.mov"),
      "isolated UI fixture",
    );
    await service.store.mutate(
      created.id,
      created.revision,
      (project) => {
        project.source = {
          durationMs: 10000,
          width: 640,
          height: 360,
          fps: 30,
          screen: "media/screen.mov",
        };
        project.status = "ready";
        project.edits.segments = [{ startMs: 0, endMs: 10000 }];
      },
      false,
    );
    const schema = z.object({
      id: z.unknown().optional(),
      method: z.string(),
      params: z.record(z.string(), z.unknown()).optional(),
    });
    await page.route("**/api/command", async (route) => {
      const request = schema.parse(route.request().postDataJSON());
      try {
        if (request.method === "project.save") {
          if (delaySave)
            await new Promise<void>((resolve) => {
              releaseSave = resolve;
            });
          if (failSave) throw new Error("Unable to save this change: disk full");
        }
        await route.fulfill({
          json: { id: request.id, result: await service.command(request.method, request.params) },
        });
      } catch (error) {
        await route.fulfill({ json: { id: request.id, error: errorOf(error) } });
      }
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:1421");
    await page.getByRole("button", { name: "Open First edit fixture", exact: true }).click();
    await page.locator(".app").evaluate((element) => element.classList.add("desktop"));
    const titlebar = await page.locator(".preview-toolbar").boundingBox();
    const rail = await page.locator(".tool-rail").boundingBox();
    const railControls = await page.locator(".tool-rail-controls").boundingBox();
    const backButton = await page
      .getByRole("button", { name: "Back to projects", exact: true })
      .boundingBox();
    expect(titlebar).not.toBeNull();
    expect(rail).not.toBeNull();
    expect(railControls).not.toBeNull();
    expect(backButton).not.toBeNull();
    expect(rail!.y).toBeGreaterThanOrEqual(titlebar!.y + titlebar!.height);
    expect(railControls!.y).toBeGreaterThanOrEqual(titlebar!.y + titlebar!.height);
    expect(backButton!.y).toBeGreaterThanOrEqual(titlebar!.y + titlebar!.height);
    await expect(page.locator(".tool-rail")).toHaveCSS("overflow-y", "hidden");
    await expect(page.locator(".tool-rail")).toHaveCSS("width", "65px");
    await expect(page.locator(".tool-rail-controls")).toHaveCSS("overflow-y", "auto");
    await expect(page.getByRole("complementary", { name: "First edit guide" })).toBeVisible();
    await expect(page.getByText("Saved automatically", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Show me how", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Quick start" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. Split and remove" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Show me how", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Dismiss first edit guide" }).click();
    await expect(page.getByRole("complementary", { name: "First edit guide" })).toHaveCount(0);
    await page.getByText("Frame and spacing", { exact: true }).click();
    await page.getByRole("combobox", { name: "Frame style", exact: true }).selectOption("minimal");
    await expect(
      page.locator("details").filter({ has: page.getByText("Frame and spacing", { exact: true }) }),
    ).toHaveAttribute("open", "");
    delaySave = true;
    await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeVisible();
    await page.keyboard.press("Meta+s");
    await expect(page.getByText("Saving changes…", { exact: true })).toBeVisible();
    releaseSave();
    await expect(page.getByText("Saved automatically", { exact: true })).toBeVisible();
    delaySave = false;
    failSave = true;
    await page.keyboard.press("Meta+s");
    await expect(page.getByText("Change could not be saved", { exact: true })).toBeVisible();
    failSave = false;
    await page.keyboard.press("Meta+s");
    await expect(page.getByText("Saved automatically", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 960, height: 760 });
    await expect(page.getByRole("button", { name: "Export", exact: true })).toBeInViewport();
    await expect(page.getByText("Saved automatically", { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("editor-960.png") });
    await page.reload();
    await page.getByRole("button", { name: "Open First edit fixture", exact: true }).click();
    await expect(page.getByRole("complementary", { name: "First edit guide" })).toHaveCount(0);
  } finally {
    releaseSave();
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
