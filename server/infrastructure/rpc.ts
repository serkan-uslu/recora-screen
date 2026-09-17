import { createServer, createConnection, type Server, type Socket } from "node:net";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { AppError, errorOf } from "@/server/contracts/validation.js";
import { socketPath } from "@/server/infrastructure/ProjectStore.js";
import type { ApplicationService } from "@/server/service.js";

export function readLines(
  socket: NodeJS.ReadableStream,
  onLine: (line: string) => void,
  fail: (error: Error) => void,
) {
  let buffer = "";
  socket.setEncoding?.("utf8");
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    if (buffer.length > 64_000_000) {
      fail(new AppError("MESSAGE_TOO_LARGE", "RPC message exceeds 64 MB"));
      buffer = "";
      return;
    }
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (line.trim()) onLine(line);
    }
  });
}
export async function serveSocket(service: ApplicationService, file = socketPath): Promise<Server> {
  if (process.platform !== "win32") {
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const parent = await fs.lstat(path.dirname(file));
    if (parent.isSymbolicLink() || (process.getuid && parent.uid !== process.getuid()))
      throw new AppError("INVALID_SOCKET", "Service directory must belong to the current user");
    await fs.chmod(path.dirname(file), 0o700);
    if (
      await fs.lstat(file).then(
        () => true,
        () => false,
      )
    ) {
      const alive = await new Promise<boolean>((resolve) => {
        const s = createConnection(file);
        s.once("connect", () => {
          s.destroy();
          resolve(true);
        });
        s.once("error", () => resolve(false));
      });
      if (alive)
        throw new AppError("ALREADY_RUNNING", "The desktop app already owns the project service");
      await fs.unlink(file);
    }
  }
  const server = createServer((socket) => {
    socket.on("error", () => {});
    const changed = (data: unknown) =>
      socket.write(JSON.stringify({ event: "project-changed", data }) + "\n");
    service.on("project-changed", changed);
    socket.on("close", () => service.off("project-changed", changed));
    readLines(
      socket,
      (line) => {
        let request: { id: string; method: string; params?: unknown };
        try {
          request = JSON.parse(line);
          if (typeof request.id !== "string" || typeof request.method !== "string")
            throw new AppError("INVALID_REQUEST", "RPC id and method are required");
        } catch (error) {
          socket.write(JSON.stringify({ error: errorOf(error) }) + "\n");
          return;
        }
        service.command(request.method, request.params).then(
          (result) => socket.write(JSON.stringify({ id: request.id, result }) + "\n"),
          (error) => socket.write(JSON.stringify({ id: request.id, error: errorOf(error) }) + "\n"),
        );
      },
      (error) => socket.destroy(error),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(file, () => {
      server.off("error", reject);
      resolve();
    });
  });
  if (process.platform !== "win32") await fs.chmod(file, 0o600);
  return server;
}
export class AppClient {
  private socket?: Socket;
  private connecting?: Promise<void>;
  private pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: unknown) => void;
      timer: NodeJS.Timeout;
    }
  >();
  constructor(private readonly file = socketPath) {}
  async connect(startApp = true) {
    if (this.socket && !this.socket.destroyed) return;
    if (this.connecting) return this.connecting;
    const connecting = this.connectOnce(startApp);
    this.connecting = connecting;
    try {
      await connecting;
    } finally {
      if (this.connecting === connecting) this.connecting = undefined;
    }
  }
  private async connectOnce(startApp: boolean) {
    try {
      await this.open();
      return;
    } catch (error) {
      if (!startApp) throw error;
    }
    if (process.platform !== "darwin")
      throw new AppError("APP_NOT_RUNNING", "Open Recora Screen before connecting the MCP server.");
    await new Promise<void>((resolve, reject) => {
      const bundle = process.env.SCREENREC_APP_BUNDLE;
      const child = spawn(
        "/usr/bin/open",
        bundle ? ["-a", bundle] : ["-b", "com.screenrecorder.desktop"],
        { stdio: "ignore" },
      );
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(
              new AppError(
                "APP_NOT_FOUND",
                "Install and open Recora Screen before using its MCP server.",
              ),
            ),
      );
    });
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await this.open();
        return;
      } catch {
        await delay(300);
      }
    }
    throw new AppError(
      "APP_NOT_RUNNING",
      "Recora Screen did not start its local service. Open the app and try reconnecting.",
    );
  }
  private async open() {
    const socket = createConnection(this.file);
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    this.socket = socket;
    readLines(
      socket,
      (line) => {
        try {
          const response = JSON.parse(line),
            pending = this.pending.get(response.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(response.id);
          if (response.error) {
            pending.reject(
              new AppError(
                response.error.code ?? "FAILED",
                response.error.message,
                response.error.details,
              ),
            );
          } else {
            pending.resolve(response.result);
          }
        } catch (error) {
          socket.destroy(error instanceof Error ? error : undefined);
        }
      },
      (error) => socket.destroy(error),
    );
    socket.on("error", () => {});
    socket.on("close", () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(
          new AppError(
            "APP_DISCONNECTED",
            "The desktop app disconnected. Reconnect before retrying.",
          ),
        );
      }
      this.pending.clear();
    });
  }
  async call(method: string, params: Record<string, unknown> = {}) {
    if (!this.socket || this.socket.destroyed) await this.connect();
    const id = randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy heterogeneous RPC boundary; inputs are schema-validated by CommandController. Keep domain code typed.
    return new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new AppError(
            "TIMEOUT",
            "The app did not respond. Check job status before retrying a side effect.",
          ),
        );
      }, 120000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  close() {
    this.socket?.destroy();
  }
}
