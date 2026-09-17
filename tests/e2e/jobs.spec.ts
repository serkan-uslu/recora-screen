import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { errorOf } from "@/server/contracts/validation";
import { ApplicationService } from "@/server/services/ApplicationService";
import { models } from "@/server/services/ai";

test("model jobs report progress, cancel, and refresh installed models", async ({ page }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "recora-jobs-ui-"));
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async () => {
      throw new Error("Native calls are not used by this browser job fixture");
    },
  });
  await service.initialize();

  const installed = new Set<string>();
  let finishSmall = () => {};
  const smallGate = new Promise<void>((resolve) => {
    finishSmall = resolve;
  });
  service.localAI.list = async () =>
    models.map((model) => ({ ...model, installed: installed.has(model.id) }));
  service.localAI.download = async (id, signal, progress) => {
    progress(0.4, `Downloading ${id}: 12 MB`);
    if (id === "base") {
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
      throw new Error("Cancelled model job continued");
    }
    await smallGate;
    signal.throwIfAborted();
    installed.add(id);
    return { model: id, path: path.join(root, `ggml-${id}.bin`), verified: true };
  };

  const methods: string[] = [];
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
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:1421");
    await page.getByRole("button", { name: "Settings & MCP", exact: true }).click();

    const base = page.locator(".model-list > div").filter({ hasText: "Whisper Base" });
    await base.getByRole("button", { name: "Download", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Make yourself at home." })).toHaveCount(0);
    const job = page.locator(".job-card");
    await expect(job.getByText("Downloading AI model", { exact: true })).toBeVisible();
    await expect(job.getByText("Downloading base: 12 MB", { exact: true })).toBeVisible();
    await expect(job.locator("progress")).toHaveAttribute("value", "0.4");
    await job.getByRole("button", { name: "Cancel job", exact: true }).click();
    await expect(job).toHaveCount(0);
    expect(methods).toContain("jobs.cancel");

    await page.getByRole("button", { name: "Settings & MCP", exact: true }).click();
    const modelListCalls = methods.filter((method) => method === "ai.models/list").length;
    const small = page.locator(".model-list > div").filter({ hasText: "Whisper Small" });
    await small.getByRole("button", { name: "Download", exact: true }).click();
    await expect(job.getByText("Downloading small: 12 MB", { exact: true })).toBeVisible();
    finishSmall();
    await expect(job).toHaveCount(0);
    await expect
      .poll(() => methods.filter((method) => method === "ai.models/list").length)
      .toBeGreaterThan(modelListCalls);
    await page.getByRole("button", { name: "Settings & MCP", exact: true }).click();
    await expect(
      page
        .locator(".model-list > div")
        .filter({ hasText: "Whisper Small" })
        .getByText("Installed", { exact: true }),
    ).toBeVisible();
    expect(methods).toContain("jobs.list");
  } finally {
    finishSmall();
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
