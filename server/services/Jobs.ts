import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Job } from "../../shared/types.js";
import { atomicJSON } from "../infrastructure/ProjectStore.js";
import { AppError, errorOf } from "../contracts/validation.js";

export class Jobs {
  private rows = new Map<string, Job>();
  private controllers = new Map<string, AbortController>();
  private writes: Promise<unknown> = Promise.resolve();
  constructor(private readonly dir: string) {}
  async initialize() {
    try {
      const saved = JSON.parse(
        await fs.readFile(path.join(this.dir, "jobs.json"), "utf8"),
      );
      for (const job of saved as Job[]) {
        if (job.status === "running" || job.status === "queued")
          Object.assign(job, {
            status: "failed",
            error:
              "The application closed before this job finished. Start it again.",
            message: "Interrupted",
          });
        this.rows.set(job.id, job);
      }
    } catch (e: any) {
      if (e.code !== "ENOENT")
        console.error("Could not restore job history:", e.message);
    }
  }
  private persist() {
    const snapshot = [...this.rows.values()].slice(-200);
    this.writes = this.writes
      .catch(() => {})
      .then(() => atomicJSON(path.join(this.dir, "jobs.json"), snapshot));
    this.writes.catch((error) =>
      console.error("Could not save job status:", error.message),
    );
  }
  list(projectId?: string) {
    return structuredClone(
      [...this.rows.values()].filter(
        (j) => !projectId || j.projectId === projectId,
      ),
    );
  }
  get(id: string) {
    const job = this.rows.get(id);
    if (!job) throw new AppError("NOT_FOUND", "Job not found");
    return structuredClone(job);
  }
  active(projectId?: string) {
    return this.list(projectId).filter(
      (j) => j.status === "running" || j.status === "queued",
    );
  }
  start(
    kind: Job["kind"],
    projectId: string | undefined,
    work: (
      signal: AbortSignal,
      progress: (value: number, message: string) => void,
      jobId: string,
    ) => Promise<unknown>,
  ): Job {
    const job: Job = {
      id: randomUUID(),
      projectId,
      kind,
      status: "queued",
      progress: 0,
      message: "Queued",
      createdAt: new Date().toISOString(),
    };
    const controller = new AbortController();
    this.rows.set(job.id, job);
    this.controllers.set(job.id, controller);
    this.persist();
    setImmediate(async () => {
      try {
        controller.signal.throwIfAborted();
        job.status = "running";
        job.message = "Starting";
        this.persist();
        const result = await work(
          controller.signal,
          (value, message) => {
            job.progress = Math.min(1, Math.max(0, value));
            job.message = message;
          },
          job.id,
        );
        controller.signal.throwIfAborted();
        Object.assign(job, {
          status: "completed",
          progress: 1,
          message: "Complete",
          result,
        });
      } catch (error) {
        Object.assign(
          job,
          controller.signal.aborted
            ? { status: "cancelled", message: "Cancelled" }
            : {
                status: "failed",
                message: "Failed",
                error: errorOf(error).message,
              },
        );
      } finally {
        this.controllers.delete(job.id);
        this.persist();
      }
    });
    return structuredClone(job);
  }
  cancel(id: string) {
    const job = this.get(id);
    this.controllers.get(id)?.abort(new AppError("CANCELLED", "Job cancelled"));
    return job;
  }
  async flush() {
    await this.writes;
  }
}
