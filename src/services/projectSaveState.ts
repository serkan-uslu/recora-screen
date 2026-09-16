type SaveState = "saved" | "saving" | "failed";
const writes = new Set([
  "timeline.apply",
  "history.undo",
  "history.redo",
  "asset.import",
  "project.save",
  "project.rename",
  "camera.layout.set",
  "camera.layout.remove",
]);
const projects = new Map<string, { pending: number; failed: boolean }>();
const listeners = new Set<() => void>();

export function subscribeProjectSave(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function projectSaveState(projectId: string | undefined): SaveState {
  const state = projectId ? projects.get(projectId) : undefined;
  return state?.pending ? "saving" : state?.failed ? "failed" : "saved";
}

export async function trackProjectWrite<T>(
  method: string,
  params: Record<string, unknown>,
  action: () => Promise<T>,
): Promise<T> {
  if (!writes.has(method) || typeof params.projectId !== "string") return action();
  const previous = projects.get(params.projectId);
  const state = previous?.pending ? previous : { pending: 0, failed: false };
  projects.set(params.projectId, state);
  state.pending++;
  listeners.forEach((listener) => listener());
  try {
    return await action();
  } catch (error) {
    state.failed = true;
    throw error;
  } finally {
    state.pending--;
    listeners.forEach((listener) => listener());
  }
}
