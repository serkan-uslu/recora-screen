export type PreviewItem = { kind: 'camera' | 'overlay'; id: string; x: number; y: number; width: number; height: number };
export type PreviewGeometry = { width: number; height: number; items: PreviewItem[] };
export type PlaybackState = { timeMs: number; playing: boolean; scrubbing: boolean; geometry?: PreviewGeometry };
type Send = (method: string, params?: Record<string, unknown>) => Promise<any>;

/** Transient playback has its own subscribers; it never updates the project or inspector. */
export function createPreviewPlayback(send: Send, onError: (error: unknown) => void) {
  let state: PlaybackState = { timeMs: 0, playing: false, scrubbing: false };
  let total = 0, epoch = 0, scope = 0, resume = false;
  let pending: { timeMs: number; scope: number; inputAtMs: number } | null = null;
  let running: Promise<void> | null = null;
  let pauseBarrier = Promise.resolve();
  const listeners = new Set<() => void>();
  const update = (patch: Partial<PlaybackState>) => {
    if (Object.entries(patch).every(([key, value]) => state[key as keyof PlaybackState] === value)) return;
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const drain = (): Promise<void> => {
    if (running) return running;
    const work = (async () => {
      await pauseBarrier;
      while (pending) {
        const target = pending;
        pending = null;
        if (target.scope !== scope) continue;
        try { await send('preview.seek', { timeMs: target.timeMs, inputAtMs: target.inputAtMs }); }
        catch (error) { if (target.scope === scope) onError(error); }
      }
    })();
    running = work;
    void work.finally(() => { if (running === work) running = null; if (pending) void drain(); });
    return work;
  };
  const seek = async (value: number) => {
    const timeMs = Math.max(0, Math.min(value, total));
    epoch++;
    update({ timeMs });
    pending = { timeMs, scope, inputAtMs: Date.now() };
    await drain();
  };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    reset(duration: number) { scope++; epoch++; total = duration; pending = null; resume = false; update({ timeMs: 0, playing: false, scrubbing: false, geometry: undefined }); },
    setDuration(duration: number) { total = duration; if (state.timeMs > total) void seek(total); },
    seek,
    async poll() {
      const token = epoch, currentScope = scope;
      try {
        const result = await send('preview.status');
        if (token !== epoch || currentScope !== scope || state.scrubbing || running || pending) return;
        if (result) update({ timeMs: result.timeMs ?? state.timeMs, playing: !!result.playing, geometry: result.geometry });
      } catch { /* Initial loading reports its own error. */ }
    },
    beginScrub() {
      if (state.scrubbing) return;
      epoch++;
      resume = state.playing;
      update({ scrubbing: true, playing: false });
      pauseBarrier = send('preview.pause').then(() => {}, onError);
    },
    async endScrub(value: number, _cancelled = false) {
      const token = scope;
      await seek(value);
      if (token !== scope) return;
      update({ scrubbing: false });
      const shouldResume = resume;
      resume = false;
      if (shouldResume) {
        try { await send('preview.play'); if (token === scope) update({ playing: true }); }
        catch (error) { if (token === scope) onError(error); }
      }
    },
    async toggle() {
      const token = ++epoch, currentScope = scope;
      const next = !state.playing;
      try { await send(next ? 'preview.play' : 'preview.pause'); if (token === epoch && currentScope === scope) update({ playing: next }); }
      catch (error) { if (currentScope === scope) onError(error); }
    },
  };
}
export type PreviewPlayback = ReturnType<typeof createPreviewPlayback>;
