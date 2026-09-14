import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError, checkRevision } from "@/server/contracts/validation.js";
import { cursorClicks } from "@/server/domain/cursor.js";
import { applyEdits } from "@/server/domain/edits.js";
import type { ProjectStore } from "@/server/infrastructure/ProjectStore.js";
import type { PreviewService } from "@/server/services/PreviewService.js";
import type { CommandParams } from "@/server/services/types.js";
import type { CursorEvent, EditOperation } from "@/shared/types.js";

export class EditingService {
  constructor(
    private readonly store: ProjectStore,
    private readonly preview: PreviewService,
  ) {}

  async apply(params: CommandParams) {
    let events: CursorEvent[] = [];
    if (
      (params.operations as EditOperation[]).some((operation) => operation.type === "zooms.auto")
    ) {
      const project = await this.store.get(params.projectId);
      if (project.source?.cursor)
        events = await cursorClicks(
          await this.store.resolveMedia(project.id, project.source.cursor),
        );
    }
    return this.preview.refresh(
      await this.store.mutate(params.projectId, params.expectedRevision, (project) => {
        applyEdits(project, params.operations, events);
      }),
    );
  }

  async command(method: string, p: CommandParams): Promise<unknown> {
    switch (method) {
      case "camera.layout.set":
      case "camera.layout.remove": {
        const { projectId, expectedRevision, ...operation } = p;
        return this.apply({
          projectId,
          expectedRevision,
          operations: [{ ...operation, type: method }],
        });
      }
      case "timeline.apply":
        return this.apply(p);
      case "history.undo":
      case "history.redo":
        return this.preview.refresh(
          await this.store.history(
            p.projectId,
            p.expectedRevision,
            method.endsWith("undo") ? "undo" : "redo",
          ),
        );
      case "asset.import":
        return this.importAsset(p);
      default:
        throw new AppError("UNKNOWN_METHOD", method);
    }
  }

  private async importAsset(p: CommandParams) {
    this.store.assertIdle(p.projectId);
    const project = await this.store.get(p.projectId);
    if (p.expectedRevision !== undefined) checkRevision(project.revision, p.expectedRevision);
    const inputInfo = await fs.lstat(p.path);
    if (inputInfo.isSymbolicLink())
      throw new AppError("INVALID_PATH", "Symbolic links cannot be imported");
    const info = await fs.stat(p.path);
    if (!info.isFile() || info.size > 50_000_000)
      throw new AppError("INVALID_ASSET", "Select a PNG, JPEG or WebP image smaller than 50 MB.");
    const handle = await fs.open(p.path, "r");
    const header = Buffer.alloc(16);
    try {
      await handle.read(header, 0, 16, 0);
    } finally {
      await handle.close();
    }
    const extension = header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? ".png"
      : header[0] === 255 && header[1] === 216
        ? ".jpg"
        : header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP"
          ? ".webp"
          : "";
    if (!extension)
      throw new AppError("INVALID_ASSET", "Only PNG, JPEG and WebP images are supported.");
    const assetId = randomUUID();
    const relative = `assets/${assetId}${extension}`;
    await this.store.copyMedia(project.id, p.path, relative);
    return this.store.mutate(project.id, project.revision, (current) => {
      current.assets.push({
        id: assetId,
        name: path.basename(p.path).slice(0, 200),
        path: relative,
        kind: "image",
      });
    });
  }
}
