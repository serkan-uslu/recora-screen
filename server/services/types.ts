export type NativeCall = (
  method: string,
  params?: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Native RPC returns method-specific validated payloads.
) => Promise<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- CommandController validates each method before dispatch.
export type CommandParams = Record<string, any>;
