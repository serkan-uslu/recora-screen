import { methodSchemas, isReadOnly } from "@/server/contracts/commands.js";
import { AppError, object, id } from "@/server/contracts/validation.js";

/** Shared trust boundary for UI, MCP and local RPC. */
export class CommandController {
  private pending = new Map<string, { signature: string; result: Promise<unknown> }>();
  private shuttingDown = false;
  private queues = new Map<string, Promise<unknown>>();
  constructor(
    private dispatch: (
      method: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy heterogeneous RPC boundary; inputs are schema-validated by CommandController. Keep domain code typed.
      params: Record<string, any>,
    ) => Promise<unknown>,
  ) {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy heterogeneous RPC boundary; inputs are schema-validated by CommandController. Keep domain code typed.
  async command(method: string, input: unknown = {}): Promise<any> {
    const schema = methodSchemas[method];
    if (!schema) throw new AppError("UNKNOWN_METHOD", `Unknown command: ${method}`);
    const { requestId, ...raw } = object(input);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy heterogeneous RPC boundary; inputs are schema-validated by CommandController. Keep domain code typed.
    const params = schema.parse(raw) as Record<string, any>;
    const execute = () => this.dispatch(method, params);
    if (this.shuttingDown && method !== "app.canQuit")
      throw new AppError(
        "APP_CLOSING",
        "The application is closing. Reopen it before making changes.",
      );
    if (method === "app.shutdown") {
      this.shuttingDown = true;
      try {
        await Promise.all([...this.queues.values()].map((work) => work.catch(() => {})));
        return await execute();
      } catch (error) {
        this.shuttingDown = false;
        throw error;
      }
    }
    if (!requestId) return this.serialize(method, params, execute);
    const requestKey = id.parse(requestId),
      signature = JSON.stringify({ method, params });
    const cached = this.pending.get(requestKey);
    if (cached) {
      if (cached.signature !== signature)
        throw new AppError(
          "REQUEST_ID_CONFLICT",
          "This requestId was already used for a different command",
        );
      return structuredClone(await cached.result);
    }
    const result = this.serialize(method, params, execute);
    this.pending.set(requestKey, { signature, result });
    // ponytail: retain the latest 1000 retry receipts for this app session; durable receipts only if restart retries are introduced.
    if (this.pending.size > 1000) this.pending.delete(this.pending.keys().next().value!);
    return structuredClone(await result);
  }
  private serialize(
    method: string,
    params: Record<string, unknown>,
    action: () => Promise<unknown>,
  ) {
    if (
      isReadOnly(method) ||
      method === "recording.status" ||
      method === "jobs.cancel" ||
      (method.startsWith("preview.") &&
        !["preview.draft", "preview.load", "preview.reset"].includes(method))
    )
      return action();
    const keys = [
      ...(params.projectId ? [`project:${params.projectId}`] : []),
      ...(method.startsWith("preview.") ? ["preview"] : []),
      ...(method.startsWith("recording.") ? ["recording-device"] : []),
    ];
    if (!keys.length) keys.push(method.split(".")[0]!);
    const prior = keys.map((key) => (this.queues.get(key) ?? Promise.resolve()).catch(() => {}));
    const result = Promise.all(prior).then(action);
    for (const key of keys) this.queues.set(key, result);
    const release = () => {
      for (const key of keys) if (this.queues.get(key) === result) this.queues.delete(key);
    };
    void result.then(release, release);
    return result;
  }
}
