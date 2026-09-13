import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { createPreviewPlayback } from '../src/controllers/previewPlayback.js';
import { reconcileProjectRefresh } from '../src/controllers/useStudioController.js';
import { defaultEdits, type Project } from '../shared/types.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test('scrubbing waits for pause, keeps one seek in flight, chases only the latest target and restores playback', async () => {
  const pause = deferred<void>(), requests: { target: number; done: ReturnType<typeof deferred<void>> }[] = [];
  const methods: string[] = [], errors: unknown[] = [];
  let active = 0, maximum = 0;
  const playback = createPreviewPlayback(async (method, params) => {
    methods.push(method);
    if (method === 'preview.status') return { timeMs: 10, playing: true };
    if (method === 'preview.pause') return pause.promise;
    if (method === 'preview.seek') {
      assert(Number.isFinite(params!.inputAtMs), 'seek carries its original input timestamp through the queue');
      const done = deferred<void>(); requests.push({ target: params!.timeMs as number, done });
      maximum = Math.max(maximum, ++active); await done.promise; active--; return {};
    }
    return {};
  }, error => errors.push(error));
  playback.reset(1000); await playback.poll();
  playback.beginScrub();
  const first = playback.seek(100), second = playback.seek(200);
  await tick(); assert.equal(requests.length, 0, 'audio pause completes before any scrub seek');
  pause.resolve(); await tick(); assert.deepEqual(requests.map(r => r.target), [200]);
  const third = playback.seek(300), fourth = playback.seek(400), finished = playback.endScrub(500);
  assert.equal(playback.getSnapshot().timeMs, 500, 'playhead responds before native seek completes');
  assert.equal(playback.getSnapshot().playing, false);
  requests[0]!.done.resolve(); await tick();
  assert.deepEqual(requests.map(r => r.target), [200, 500]);
  assert.equal(methods.includes('preview.play'), false);
  requests[1]!.done.resolve();
  await Promise.all([first, second, third, fourth, finished]);
  assert.equal(maximum, 1); assert.deepEqual(errors, []);
  assert.equal(playback.getSnapshot().scrubbing, false); assert.equal(playback.getSnapshot().playing, true);
  assert.equal(methods.at(-1), 'preview.play');
});

test('late status never reverses a seek or leaks into a new project; unchanged polling does not notify subscribers', async () => {
  const statuses: ReturnType<typeof deferred<any>>[] = [], errors: unknown[] = [];
  const playback = createPreviewPlayback(async method => {
    if (method === 'preview.status') { const result = deferred<any>(); statuses.push(result); return result.promise; }
    return {};
  }, error => errors.push(error));
  playback.reset(1000);
  let updates = 0; playback.subscribe(() => updates++);
  const stale = playback.poll(); await playback.seek(700);
  statuses[0]!.resolve({ timeMs: 10, playing: true }); await stale;
  assert.equal(playback.getSnapshot().timeMs, 700); assert.equal(playback.getSnapshot().playing, false);
  const previousProject = playback.poll(); playback.reset(2000);
  statuses[1]!.resolve({ timeMs: 900, playing: true }); await previousProject;
  assert.equal(playback.getSnapshot().timeMs, 0); assert.equal(playback.getSnapshot().playing, false);
  const count = updates, same = playback.poll(); statuses[2]!.resolve({ timeMs: 0, playing: false }); await same;
  assert.equal(updates, count); assert.deepEqual(errors, []);
});

test('seek clamps to duration, surfaces failure and continues with the latest target', async () => {
  const first = deferred<void>(), targets: number[] = [], errors: unknown[] = [];
  const playback = createPreviewPlayback(async (method, params) => {
    if (method === 'preview.seek') {
      targets.push(params!.timeMs as number);
      if (targets.length === 1) { await first.promise; throw Error('Decode failed'); }
    }
    return {};
  }, error => errors.push(error));
  playback.reset(1000);
  const a = playback.seek(-50); await tick();
  const b = playback.seek(2000); first.resolve(); await Promise.all([a, b]);
  assert.deepEqual(targets, [0, 1000]); assert.equal(errors.length, 1);
  playback.setDuration(500); await tick();
  assert.equal(playback.getSnapshot().timeMs, 500); assert.equal(targets.at(-1), 500);
});

test('a delayed play response cannot change playback state after switching projects', async () => {
  const play = deferred<void>(), errors: unknown[] = [];
  const playback = createPreviewPlayback(async method => method === 'preview.play' ? play.promise : {}, error => errors.push(error));
  playback.reset(1000);
  const toggled = playback.toggle(); playback.reset(2000);
  play.resolve(); await toggled;
  assert.equal(playback.getSnapshot().playing, false);
  assert.deepEqual(errors, []);
});

test('project switch while scrub playback resumes cannot mark the new project playing', async () => {
  const play = deferred<void>(), errors: unknown[] = [];
  const playback = createPreviewPlayback(async method => {
    if (method === 'preview.status') return { timeMs: 0, playing: true };
    if (method === 'preview.play') return play.promise;
    return {};
  }, error => errors.push(error));
  playback.reset(1000); await playback.poll(); playback.beginScrub();
  const finish = playback.endScrub(300); await tick();
  playback.reset(2000); play.resolve(); await finish;
  assert.equal(playback.getSnapshot().playing, false); assert.equal(playback.getSnapshot().timeMs, 0);
  assert.deepEqual(errors, []);
});

test('delayed project refreshes preserve a project switch, dashboard navigation and newer committed revisions', async () => {
  const a: Project = { schemaVersion: 2, id: 'a', name: 'A', revision: 1, status: 'draft', createdAt: '', updatedAt: '', edits: defaultEdits(), transcript: [], assets: [] };
  const b = { ...a, id: 'b', name: 'B' };
  for (const destination of [b, null, { ...a, revision: 3 }]) {
    let current: Project | null = a;
    const read = deferred<Project>();
    const refreshing = read.promise.then(next => { current = reconcileProjectRefresh(current, next); });
    current = destination;
    read.resolve({ ...a, revision: 2 }); await refreshing;
    assert.equal(current, destination);
  }
  const newer = { ...a, revision: 2 };
  assert.equal(reconcileProjectRefresh(a, newer), newer);
});
