import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { errorOf } from "@/server/contracts/validation";
import { ApplicationService } from "@/server/services/ApplicationService";
import type { RecordingStatus } from "@/shared/types";

test("recording controls use the shared command service from first click through finish", async ({
  page,
}) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "recora-recording-ui-"));
  const methods: string[] = [];
  const nativeCalls: { method: string; params: unknown }[] = [];
  let screenGranted = false;
  let releaseActivePoll = () => {};
  const activePoll = new Promise<void>((resolve) => {
    releaseActivePoll = resolve;
  });
  let recording: RecordingStatus = {
    active: false,
    paused: false,
    durationMs: 0,
    microphoneLevel: 0,
    systemLevel: 0,
    cameraVisible: false,
    cameraEnabled: false,
  };
  const service = new ApplicationService({
    projectsDir: path.join(root, "projects"),
    dataDir: path.join(root, "data"),
    native: async (method, params) => {
      nativeCalls.push({ method, params });
      if (method === "capabilities")
        return {
          platform: "macos",
          permissions: {
            screen: screenGranted,
            input: true,
            camera: "authorized",
            microphone: "authorized",
          },
          cameras: [{ id: "camera-1", name: "Test camera" }],
          microphones: [{ id: "microphone-1", name: "Test microphone" }],
          recording,
          sources: [
            { id: "display-1", kind: "display", name: "Test display", width: 1920, height: 1080 },
          ],
        };
      if (method === "permissions.request") {
        if (z.object({ kind: z.string() }).parse(params).kind === "screen") screenGranted = true;
        return {
          screen: screenGranted,
          input: true,
          camera: "authorized",
          microphone: "authorized",
        };
      }
      if (method === "recording.status") return recording;
      if (method === "recording.start") {
        const input = z
          .object({ projectId: z.string(), projectDir: z.string() })
          .passthrough()
          .parse(params);
        await Promise.all([
          fs.writeFile(path.join(input.projectDir, "media/screen.mov"), "screen fixture"),
          fs.writeFile(path.join(input.projectDir, "media/camera.mov"), "camera fixture"),
          fs.writeFile(path.join(input.projectDir, "media/microphone.m4a"), "audio fixture"),
        ]);
        recording = {
          ...recording,
          active: true,
          projectId: input.projectId,
          cameraVisible: true,
          cameraEnabled: true,
          phase: "recording",
        };
        return recording;
      }
      if (method === "recording.camera") {
        const input = z
          .object({ visible: z.boolean().optional(), enabled: z.boolean().optional() })
          .parse(params);
        recording = {
          ...recording,
          ...(input.visible === undefined ? {} : { cameraVisible: input.visible }),
          ...(input.enabled === undefined ? {} : { cameraEnabled: input.enabled }),
        };
        return recording;
      }
      if (method === "recording.pause" || method === "recording.resume") {
        const paused = method === "recording.pause";
        recording = { ...recording, paused, phase: paused ? "paused" : "recording" };
        return recording;
      }
      if (method === "recording.stop") {
        recording = { ...recording, active: false, paused: false, phase: "idle" };
        releaseActivePoll();
        return {
          source: {
            durationMs: 5000,
            width: 1920,
            height: 1080,
            fps: 30,
            screen: "media/screen.mov",
            camera: "media/camera.mov",
            microphone: "media/microphone.m4a",
          },
        };
      }
      if (method === "preview.frame") return { ok: true };
      if (method === "media.filmstrip") return [];
      if (method === "media.waveform") return [0];
      throw new Error(`Native call not used by recording UI test: ${method}`);
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
      if (request.method === "jobs.list" && recording.active) await activePoll;
      await route.fulfill({
        json: { id: request.id, result: await service.command(request.method, request.params) },
      });
    } catch (error) {
      await route.fulfill({ json: { id: request.id, error: errorOf(error) } });
    }
  });

  try {
    await page.goto("http://127.0.0.1:1421");
    await page.getByRole("button", { name: "Record screen", exact: true }).first().click();
    const captureDialog = page.getByRole("dialog", { name: "Make your next take." });
    await expect(captureDialog).toBeVisible();
    const screenPermission = captureDialog.getByRole("button", {
      name: "Screen recording",
      exact: true,
    });
    await expect(screenPermission).toBeEnabled();
    await screenPermission.click();
    await expect(screenPermission).toBeDisabled();
    await expect(captureDialog.locator("select").nth(1)).toHaveValue("camera-1");
    await expect(captureDialog.locator("select").nth(2)).toHaveValue("microphone-1");
    await page.getByRole("button", { name: "Start recording", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Your recording starts in…" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hide camera", exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect.poll(() => recording.active).toBe(true);
    await expect(page.getByRole("button", { name: "Hide camera", exact: true })).toBeEnabled();

    await page.getByRole("button", { name: "Hide camera", exact: true }).click();
    await expect(page.getByRole("button", { name: "Show camera", exact: true })).toBeVisible();
    await page
      .getByRole("button", {
        name: "Turn camera device off (this interval cannot be restored)",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Turn camera device on", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pause recording", exact: true }).click();
    await expect(page.getByRole("button", { name: "Resume recording", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Resume recording", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause recording", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Finish", exact: true }).click();

    await expect(
      page.getByText("Recording saved. Make it your own.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish", exact: true })).toHaveCount(0);
    const [saved] = await service.store.list();
    const project = await service.store.get(saved!.id);
    expect(project.status).toBe("ready");
    expect(project.source?.durationMs).toBe(5000);
    expect(project.source?.camera).toBe("media/camera.mov");

    expect(methods.filter((method) => method === "project.create")).toHaveLength(1);
    expect(methods.filter((method) => method === "permissions.request")).toHaveLength(1);
    expect(methods.filter((method) => method === "recording.start")).toHaveLength(1);
    expect(methods.filter((method) => method === "recording.camera")).toHaveLength(2);
    expect(methods.filter((method) => method === "recording.pause")).toHaveLength(1);
    expect(methods.filter((method) => method === "recording.resume")).toHaveLength(1);
    expect(methods.filter((method) => method === "recording.stop")).toHaveLength(1);
    expect(methods).toContain("project.open");
    expect(
      nativeCalls
        .filter(({ method }) => method.startsWith("recording."))
        .map(({ method }) => method),
    ).toEqual([
      "recording.start",
      "recording.camera",
      "recording.camera",
      "recording.pause",
      "recording.resume",
      "recording.stop",
      "recording.status",
    ]);
  } finally {
    releaseActivePoll();
    await page.close();
    await service.flush();
    await fs.rm(root, { recursive: true, force: true });
  }
});
