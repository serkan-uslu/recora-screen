import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ApplicationService, methodSchemas, type NativeCall } from './service.js';
import { ProjectStore } from './store.js';
import { AppClient, serveSocket } from './rpc.js';
import { createMcpServer } from './mcp.js';
import { cursorClicks } from './cursor.js';
import { applyEdits, silenceCuts, subtitleText } from './edits.js';
import { sourceSchema, projectSchema } from './validation.js';
import { duration, outputRanges } from '../shared/timeline.js';
import type { Job, Project } from '../shared/types.js';

async function setup(t: TestContext, native?: NativeCall) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'screenrec-test-'));
  const service = new ApplicationService({ projectsDir: path.join(root, 'projects'), dataDir: path.join(root, 'data'), native });
  await service.initialize();
  t.after(async () => { await service.flush().catch(() => {}); await fs.rm(root, { recursive: true, force: true }); });
  return { root, service };
}
async function ready(service: ApplicationService): Promise<Project> {
  const p = await service.command('project.create', { name: 'Demo' });
  await fs.writeFile(path.join(service.store.dir(p.id), 'media', 'screen.mov'), 'immutable screen fixture');
  await fs.writeFile(path.join(service.store.dir(p.id), 'media', 'mic.wav'), 'audio fixture');
  return service.store.mutate(p.id, p.revision, q => {
    q.source = { durationMs: 10000, width: 1920, height: 1080, fps: 30, screen: 'media/screen.mov', microphone: 'media/mic.wav' };
    q.status = 'ready'; q.edits.segments = [{ startMs: 0, endMs: 10000 }];
  }, false);
}
async function waitJob(service: ApplicationService, id: string) {
  for (let i = 0; i < 200; i++) { const job = service.jobs.get(id); if (!['queued','running'].includes(job.status)) return job; await delay(10); }
  throw new Error('Job did not finish');
}

test('atomic edits map output times to source, survive reopening, preserve media and undo as a group', async t => {
  const { service } = await setup(t); let p = await ready(service);
  const before = p.edits;
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [
    { type: 'cut', startMs: 2000, endMs: 4000 },
    { type: 'camera.hide', hidden: true, startMs: 1000, endMs: 3000 },
    { type: 'zoom.add', zoom: { startMs: 1800, endMs: 2500, scale: 1.8, x: 0.5, y: 0.5 } },
  ] });
  assert.deepEqual(p.edits.segments, [{ startMs:0,endMs:2000 }, { startMs:4000,endMs:10000 }]);
  assert.deepEqual(p.edits.camera.hiddenRanges, [{ startMs:1000,endMs:2000 }, { startMs:4000,endMs:5000 }]);
  assert.equal(p.edits.zooms[0]!.endMs, 4500);
  const reopened = await new ProjectStore(service.store.root).get(p.id);
  assert.deepEqual(reopened, p);
  assert.equal(await fs.readFile(path.join(service.store.dir(p.id),'media/screen.mov'),'utf8'), 'immutable screen fixture');
  const undone = await service.command('history.undo', { projectId:p.id,expectedRevision:p.revision });
  assert.deepEqual(undone.edits, before);
  const redone = await service.command('history.redo', { projectId:p.id,expectedRevision:undone.revision });
  assert.deepEqual(redone.edits, p.edits);
});

test('rejects stale revisions, invalid atomic batches and conflicting retry IDs', async t => {
  const { service } = await setup(t); const p = await ready(service);
  const request = { projectId:p.id,expectedRevision:p.revision,requestId:'retry-cut',operations:[{type:'cut',startMs:1000,endMs:2000}] };
  const [a,b] = await Promise.all([service.command('timeline.apply',request), service.command('timeline.apply',request)]);
  assert.deepEqual(a,b); assert.equal(a.revision,p.revision+1);
  await assert.rejects(service.command('timeline.apply',{...request,requestId:'different'}), { code:'REVISION_CONFLICT' });
  await assert.rejects(service.command('timeline.apply',{...request,expectedRevision:a.revision}), { code:'REQUEST_ID_CONFLICT' });
  await assert.rejects(service.command('timeline.apply',{projectId:p.id,expectedRevision:a.revision,operations:[{type:'camera.update',settings:{visible:false}},{type:'cut',startMs:0,endMs:99999}]}), { code:'INVALID_RANGE' });
  assert.equal((await service.store.get(p.id)).edits.camera.visible,true);
});

test('official MCP client and UI command share one revision and one undo history', async t => {
  const { service } = await setup(t); const p = await ready(service);
  const server = createMcpServer((m,p) => service.command(m,p));
  const client = new Client({ name:'test-client',version:'1' });
  const [clientTransport,serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  const tools = await client.listTools();
  assert(tools.tools.some(t => t.name === 'recording_start'));
  assert(tools.tools.some(t => t.name === 'ai_models_download'));
  assert.equal(tools.tools.find(t => t.name === 'transcript_export')!.annotations!.readOnlyHint, false);
  const result: any = await client.callTool({ name:'timeline_apply',arguments:{ projectId:p.id,expectedRevision:p.revision,operations:[{type:'camera.update',settings:{shape:'square'}}] } });
  assert.equal(result.isError,undefined);
  const ui = await service.command('project.open',{projectId:p.id});
  assert.equal(ui.edits.camera.shape,'square'); assert.equal(ui.revision,result.structuredContent.result.revision);
  const undone = await service.command('history.undo',{projectId:p.id,expectedRevision:ui.revision});
  assert.equal(undone.edits.camera.shape,'circle');
});

test('private socket client coalesces concurrent initial connections and emits project changes', async t => {
  const { service,root } = await setup(t);
  const socket = path.join(root,'service.sock'), server = await serveSocket(service,socket), client = new AppClient(socket);
  t.after(async () => { client.close(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const result = await Promise.all([client.call('project.list'),client.call('project.list')]);
  assert.deepEqual(result,[[],[]]);
  const changed = new Promise(resolve => service.once('project-changed',resolve));
  const project = await client.call('project.create',{name:'Via socket'});
  assert.deepEqual(await changed,{projectId:project.id,revision:0});
});

test('backup recovery and source traversal validation protect project media', async t => {
  const { service } = await setup(t); const p = await ready(service);
  await service.command('project.rename',{projectId:p.id,expectedRevision:p.revision,name:'New name'});
  await fs.writeFile(path.join(service.store.dir(p.id),'project.json'),'{broken');
  const recovered = await service.store.get(p.id);
  assert.equal(recovered.recovered,true); assert.equal(recovered.source!.screen,'media/screen.mov');
  assert.equal(sourceSchema.safeParse({...recovered.source,screen:'../../private.txt'}).success,false);
  assert.equal(sourceSchema.safeParse({...recovered.source,durationMs:100_000_000}).success,true);
  await fs.symlink(os.tmpdir(),path.join(service.store.dir(p.id),'escape'));
  await assert.rejects(service.store.resolveMedia(p.id,'escape'),{code:'INVALID_PATH'});
});

test('busy recordings block editing/trash/quit; native auto-stop reconciles recovered media', async t => {
  let active = false;
  const previewLoads: string[] = [];
  const { service } = await setup(t,async (method,p) => {
    if (method === 'recording.start') { active = true; return {active:true,projectId:p!.projectId}; }
    if (method === 'recording.status') return {active};
    if (method === 'preview.load') { previewLoads.push((p!.project as Project).id); return {}; }
    if (method.startsWith('preview.')) return {};
    throw new Error(method);
  });
  const previewProject = await ready(service);
  await service.command('preview.load',{projectId:previewProject.id});
  const project = await service.command('project.create',{name:'Capture'});
  await service.command('recording.start',{projectId:project.id,settings:{sourceId:'display',sourceKind:'display',systemAudio:false,cameraShape:'circle',width:1920,height:1080,fps:30}});
  await assert.rejects(service.command('project.delete',{projectId:project.id}),{code:'PROJECT_BUSY'});
  assert.equal((await service.command('app.canQuit')).canQuit,false);
  await fs.writeFile(path.join(service.store.dir(project.id),'recovered-source.json'),JSON.stringify({durationMs:5000,width:1920,height:1080,fps:30,screen:'media/screen.mov',cameraActiveRanges:[{startMs:0,endMs:2500}]}));
  active = false;
  await service.command('recording.status');
  assert.equal((await service.store.get(project.id)).status,'ready');
  assert.equal((await service.command('app.canQuit')).canQuit,true);
  assert.deepEqual(previewLoads,[previewProject.id]);
  await service.command('timeline.apply',{projectId:previewProject.id,expectedRevision:previewProject.revision,operations:[{type:'camera.update',settings:{visible:false}}]});
  assert.deepEqual(previewLoads,[previewProject.id,previewProject.id]);
});

test('project delete routes to native Trash and active jobs prevent it', async t => {
  let trashed = '';
  const { service } = await setup(t,async (method,p) => { if(method==='project.trash') { trashed=p!.path as string; return {trashed:true}; } throw new Error(method); });
  const p = await ready(service);
  const job = service.jobs.start('export',p.id,async signal => { await delay(10000,undefined,{signal}); });
  await assert.rejects(service.command('project.delete',{projectId:p.id}),{code:'PROJECT_BUSY'});
  service.jobs.cancel(job.id); await waitJob(service,job.id);
  await service.command('project.delete',{projectId:p.id,expectedRevision:p.revision});
  assert.equal(trashed,service.store.dir(p.id));
});

test('recovered source ranges clamp to readable media before native playback',async t=>{
  let preview:Project|undefined;
  const {service}=await setup(t,async(method,p)=>{
    if(method==='media.inspect')return {durationMs:4500,width:1920,height:1080,fps:30};
    if(method==='preview.load'){preview=p!.project as Project;return {playing:false};}
    throw new Error(method);
  });
  let project=await ready(service);
  project=await service.store.mutate(project.id,project.revision,p=>{p.recovered=true;p.source!.cameraActiveRanges=[{startMs:0,endMs:9000}];},false);
  await service.command('preview.load',{projectId:project.id});
  assert.equal(preview!.source!.durationMs,4500);
  assert.deepEqual(preview!.source!.cameraActiveRanges,[{startMs:0,endMs:4500}]);
  assert.deepEqual(preview!.edits.segments,[{startMs:0,endMs:4500}]);
});

test('silence cuts preserve system sound, padding and timeline mapping; subtitles follow edits', async t => {
  const { service } = await setup(t); const p = await ready(service);
  p.edits.segments=[{startMs:0,endMs:2000},{startMs:4000,endMs:10000}];
  const mic=[{startMs:1000,endMs:2000,db:-80},{startMs:2000.000001,endMs:6000,db:-80}];
  const system=[{startMs:4500,endMs:5000,db:-15}];
  const cuts=silenceCuts(p,mic,system,-40,700,150);
  assert.deepEqual(cuts,[{startMs:1150,endMs:2350},{startMs:3150,endMs:3850}]);
  p.transcript=[{id:'caption',startMs:4000,endMs:6000,text:'Merhaba dünya'}];
  assert.match(subtitleText(p,'srt'),/00:00:02,000 --> 00:00:04,000/);
  applyEdits(p,[{type:'camera.hide',startMs:1000,endMs:4000,hidden:true},{type:'camera.hide',startMs:2000,endMs:3000,hidden:false}]);
  assert.deepEqual(p.edits.camera.hiddenRanges,[{startMs:1000,endMs:2000},{startMs:5000,endMs:6000}]);
});

test('cursor stream handles missing closing bracket, held clicks and off-capture coordinates', async t => {
  const {root}=await setup(t); const file=path.join(root,'cursor.json');
  await fs.writeFile(file,'[{"tMs":1,"x":-1,"y":0,"click":true},{"tMs":2,"x":0,"y":0,"click":false},{"tMs":3,"x":0.5,"y":0.5,"click":true},{"tMs":4,"x":0.5,"y":0.5,"click":true}');
  assert.deepEqual(await cursorClicks(file),[{tMs:3,x:0.5,y:0.5,click:true}]);
  const held = [0, 1000, 3000, 6000].map(tMs => ({ tMs, x: 0.5, y: 0.5, click: true, kind: 'click' }));
  await fs.writeFile(file, JSON.stringify(held));
  assert.deepEqual(await cursorClicks(file), [held[0]]);
  const unpaired = [0, 3000].map(tMs => ({ tMs, x: 0.5, y: 0.5, kind: 'click' }));
  await fs.writeFile(file, JSON.stringify(unpaired));
  assert.deepEqual(await cursorClicks(file), unpaired);
});

test('speed changes, cuts, splits and trims preserve source annotations and synchronized subtitle timing', async t => {
  const { service } = await setup(t); let p = await ready(service);
  p = await service.store.mutate(p.id, p.revision, q => {
    q.transcript = [{ id: 'words', startMs: 2000, endMs: 4000, text: 'Keep this timing' }];
    q.edits.camera.hiddenRanges = [{ startMs: 2000, endMs: 5000 }];
    q.edits.zooms = [{ id: 'focus', startMs: 1500, endMs: 5500, x: 0.3, y: 0.4, scale: 2 }];
    q.edits.overlays = [{ id: 'label', startMs: 2000, endMs: 4000, kind: 'text', text: 'Hello', x: 0.2, y: 0.2, width: 0.4, fontSize: 30, color: '#ffffff', animation: 'fade' }];
  }, false);
  const original = structuredClone(p);
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'speed', startMs: 1000, endMs: 5000, speed: 2 }] });
  assert.equal(duration(p.edits.segments), 8000);
  assert.match(subtitleText(p, 'srt'), /00:00:01,500 --> 00:00:02,500/);
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'cut', startMs: 1750, endMs: 2250 }] });
  assert.deepEqual(p.edits.segments, [{ startMs: 0, endMs: 1000 }, { startMs: 1000, endMs: 2500, speed: 2 }, { startMs: 3500, endMs: 5000, speed: 2 }, { startMs: 5000, endMs: 10000 }]);
  assert.equal(duration(p.edits.segments), 7500);
  assert.deepEqual(p.edits.camera, original.edits.camera);
  assert.deepEqual(p.edits.zooms, original.edits.zooms);
  assert.deepEqual(p.edits.overlays, original.edits.overlays);
  assert.deepEqual(p.transcript, original.transcript);
  assert.deepEqual(outputRanges(p.edits.segments, p.transcript[0]!), [{ startMs: 1500, endMs: 1750 }, { startMs: 1750, endMs: 2000 }]);
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'split', atMs: 1250 }, { type: 'trim', startMs: 1100, endMs: 2400 }] });
  assert(p.edits.segments.every(segment => segment.speed === 2));
  assert.equal(p.edits.segments[0]!.startMs, 1200);
  assert.equal(p.edits.segments.at(-1)!.endMs, 4800);
  assert.equal(duration(p.edits.segments), 1300);
  assert.deepEqual((await service.store.get(p.id)).edits, p.edits);
});

test('zoom partial updates and transcript text corrections preserve source times after speed and cuts', async t => {
  const { service } = await setup(t); let p = await ready(service);
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [
    { type: 'zoom.add', zoom: { startMs: 2000, endMs: 6000, x: 0.5, y: 0.5, scale: 2 } },
    { type: 'transcript.update', segments: [{ id: 'words', startMs: 2000, endMs: 6000, text: 'Before' }] },
    { type: 'speed', startMs: 0, endMs: 10000, speed: 2 },
  ] });
  const zoomId = p.edits.zooms[0]!.id;
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [
    { type: 'zoom.update', id: zoomId, zoom: { motion: 'snappy', followCursor: false, x: 0.2 } },
    { type: 'transcript.text', id: 'words', text: 'Corrected' },
  ] });
  assert.equal(p.edits.zooms[0]!.startMs, 2000); assert.equal(p.edits.zooms[0]!.endMs, 6000);
  assert.deepEqual(p.transcript, [{ id: 'words', startMs: 2000, endMs: 6000, text: 'Corrected' }]);
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'zoom.update', id: zoomId, zoom: { startMs: 500 } }] });
  assert.equal(p.edits.zooms[0]!.startMs, 1000); assert.equal(p.edits.zooms[0]!.endMs, 6000);
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'cut', startMs: 0, endMs: 3500 }] });
  await assert.rejects(service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'zoom.update', id: zoomId, zoom: { startMs: 100 } }] }), { code: 'INVALID_RANGE' });
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'zoom.update', id: zoomId, zoom: { startMs: 100, endMs: 500 } }] });
  assert.equal(p.edits.zooms[0]!.startMs, 7200); assert.equal(p.edits.zooms[0]!.endMs, 8000);
});

test('clip extension, merging and source restoration preserve neighboring speeds and source annotations', async t => {
  const { service } = await setup(t); let p = await ready(service);
  p = await service.store.mutate(p.id, p.revision, q => {
    q.edits.segments = [{ startMs: 1000, endMs: 3000, speed: 2 }, { startMs: 5000, endMs: 7000, speed: 0.5 }];
    q.transcript = [{ id: 'words', startMs: 2000, endMs: 6000, text: 'Source annotation' }];
  }, false);
  const original = structuredClone(p);
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'clip.trim', index: 0, sourceStartMs: 500, sourceEndMs: 4000 }] });
  assert.deepEqual(p.edits.segments, [{ startMs: 500, endMs: 4000, speed: 2 }, original.edits.segments[1]]);
  await assert.rejects(service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'clip.trim', index: 0, sourceStartMs: 0, sourceEndMs: 6000 }] }), { code: 'INVALID_RANGE' });
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'source.restore', startMs: 2000, endMs: 8000 }] });
  assert.deepEqual(p.edits.segments, [{ startMs: 500, endMs: 4000, speed: 2 }, { startMs: 4000, endMs: 5000 }, { startMs: 5000, endMs: 7000, speed: 0.5 }, { startMs: 7000, endMs: 8000 }]);
  assert.deepEqual(p.transcript, original.transcript);
  await assert.rejects(service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'clip.merge', index: 0 }] }), { code: 'INCOMPATIBLE_CLIPS' });
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'split', atMs: 500 }, { type: 'clip.merge', index: 0 }] });
  assert.deepEqual(p.edits.segments[0], { startMs: 500, endMs: 4000, speed: 2 });
  const restored = structuredClone(p);
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'source.restore', startMs: 2000, endMs: 8000 }] });
  assert.deepEqual(p.edits.segments, restored.edits.segments);
});

test('silence analysis maps source RMS windows onto the speed-adjusted output timeline', async t => {
  const { service } = await setup(t); const p = await ready(service);
  p.edits.segments = [{ startMs: 0, endMs: 4000, speed: 2 }, { startMs: 6000, endMs: 10000, speed: 0.5 }];
  const cuts = silenceCuts(p, [{ startMs: 1000, endMs: 8000, db: -80 }], [{ startMs: 2000, endMs: 3000, db: -10 }], -40, 700, 100);
  assert.deepEqual(cuts, [{ startMs: 550, endMs: 950 }, { startMs: 1550, endMs: 5800 }]);
  applyEdits(p, cuts.toReversed().map(range => ({ type: 'cut', ...range })));
  assert.deepEqual(p.edits.segments, [{ startMs: 0, endMs: 1100, speed: 2 }, { startMs: 1900, endMs: 3100, speed: 2 }, { startMs: 7900, endMs: 10000, speed: 0.5 }]);
});

test('legacy projects retain full-frame defaults while canvas updates validate imported image assets', async t => {
  const { service } = await setup(t); let p = await ready(service);
  p = await service.store.mutate(p.id, p.revision, q => { delete q.edits.canvas; delete q.edits.autoZoom; }, false);
  assert.equal(projectSchema.parse(p).edits.canvas, undefined);
  p = await service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'canvas.update', settings: { color: '#aabbcc' } }] });
  assert.equal(p.edits.canvas!.aspectRatio, 'source'); assert.equal(p.edits.canvas!.padding, 0); assert.equal(p.edits.canvas!.background, 'hidden');
  await assert.rejects(service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'canvas.update', settings: { background: 'image', assetId: 'missing' } }] }), { code: 'INVALID_ASSET' });
  assert.equal(projectSchema.safeParse({ ...p, edits: { ...p.edits, segments: [{ startMs: 0, endMs: 1000, speed: 9 }] } }).success, false);
  assert.equal(methodSchemas['export.start']!.safeParse({ projectId: p.id, path: '/tmp/export.mp4', width: 1080 }).success, false);
  assert.equal(methodSchemas['export.start']!.safeParse({ projectId: p.id, path: '/tmp/export.mp4', width: 2160, height: 3840 }).success, true);
});

test('cursor activity detects clicks, held drags and typing while bounding long-recording candidates', async t => {
  const { root } = await setup(t); const file = path.join(root, 'activity.json');
  await fs.writeFile(file, [
    { tMs: 0, x: 0.1, y: 0.1, click: true },
    { tMs: 500, x: 0.5, y: 0.5, click: true },
    { tMs: 600, x: 0.5, y: 0.5, click: false },
    { tMs: 2000, x: 0.8, y: 0.4, kind: 'typing' },
    { tMs: 2100, x: 0.8, y: 0.4, kind: 'typing' },
  ].map(value => JSON.stringify(value)).join('\n'));
  const events = await cursorClicks(file);
  assert.equal(events.length, 3); assert.equal(events[1]!.kind, 'drag'); assert.equal(events[2]!.kind, 'typing');
  await fs.writeFile(file, Array.from({ length: 11000 }, (_, i) => JSON.stringify({ tMs: i * 700, x: 0.5, y: 0.5, kind: 'typing' })).join('\n'));
  const long = await cursorClicks(file); assert(long.length <= 10000); assert(long.at(-1)!.tMs >= 10998 * 700);
  await fs.writeFile(file, '[{"tMs":1');
  await assert.rejects(cursorClicks(file), { code: 'INVALID_CURSOR' });
});

test('auto zoom uses click, drag and typing activity with merged settings on a sped-up timeline', async t => {
  const { service } = await setup(t); const p = await ready(service);
  p.edits.segments = [{ startMs: 0, endMs: 10000, speed: 2 }];
  applyEdits(p, [{ type: 'autoZoom.update', settings: { leadMs: 200, holdMs: 400, gapMs: 100, motion: 'snappy' } }, { type: 'zooms.auto', scale: 2.5 }], [
    { tMs: 1000, x: 0.2, y: 0.2, click: true }, { tMs: 3000, x: 0.5, y: 0.4, kind: 'drag' }, { tMs: 5000, x: 0.7, y: 0.6, kind: 'typing' },
  ]);
  assert.deepEqual(p.edits.zooms.map(({ startMs, endMs }) => ({ startMs, endMs })), [{ startMs: 600, endMs: 1800 }, { startMs: 2600, endMs: 3800 }, { startMs: 4600, endMs: 5800 }]);
  assert(p.edits.zooms.every(zoom => zoom.scale === 2.5 && zoom.motion === 'snappy' && zoom.followCursor));
  assert.equal(p.edits.autoZoom!.holdMs, 400);
});

test('finishing capture generates automatic zooms and preserves a recording when cursor metadata is damaged', async t => {
  let source: Record<string, unknown> = {};
  const { service } = await setup(t, async method => {
    if (method === 'recording.start') return { active: true };
    if (method === 'recording.stop') return { source };
    if (method.startsWith('preview.')) return {};
    throw Error(method);
  });
  for (const broken of [false, true]) {
    const p = await service.command('project.create', { name: 'Auto zoom capture' });
    await service.command('recording.start', { projectId: p.id, settings: { sourceId: 'display', sourceKind: 'display', systemAudio: false, cameraShape: 'circle', width: 1920, height: 1080, fps: 30 } });
    await fs.writeFile(path.join(service.store.dir(p.id), 'media', 'screen.mov'), 'captured media');
    await fs.writeFile(path.join(service.store.dir(p.id), 'media', 'cursor.json'), broken ? '[{"tMs":' : JSON.stringify([{ tMs: 1000, x: 0.4, y: 0.6, kind: 'typing' }]));
    source = { durationMs: 5000, width: 1920, height: 1080, fps: 30, screen: 'media/screen.mov', cursor: 'media/cursor.json', title: 'Captured window' };
    const finished = await service.command('recording.stop');
    assert.equal(finished.status, 'ready'); assert.equal(finished.source.title, 'Captured window');
    assert.equal(finished.edits.zooms.length, broken ? 0 : 1);
    assert.equal(service.store.busy.has(p.id), false);
    assert.equal(await fs.readFile(path.join(service.store.dir(p.id), 'media', 'screen.mov'), 'utf8'), 'captured media');
  }
});

test('draft preview changes render state without saving or adding history; final edits replace the draft', async t => {
  let preview: Project | undefined;
  const { service } = await setup(t, async (method, params) => {
    if (method === 'preview.load') { preview = structuredClone(params!.project as Project); return { playing: false }; }
    throw Error(method);
  });
  const p = await ready(service), before = await service.store.read(p.id);
  await assert.rejects(service.command('preview.draft', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'camera.update', settings: { x: 0.1 } }] }), { code: 'PREVIEW_NOT_ACTIVE' });
  await service.command('preview.load', { projectId: p.id });
  let changes = 0; service.on('project-changed', () => changes++);
  await service.command('preview.draft', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'camera.update', settings: { x: 0.1 } }] });
  assert.equal(preview!.edits.camera.x, 0.1); assert.equal(preview!.revision, p.revision);
  assert.deepEqual(await service.store.read(p.id), before); assert.equal(changes, 0);
  const [_, committed] = await Promise.all([
    service.command('preview.draft', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'camera.update', settings: { x: 0.2 } }] }),
    service.command('timeline.apply', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'camera.update', settings: { x: 0.3 } }] }),
  ]);
  assert.equal(preview!.edits.camera.x, 0.3); assert.equal(preview!.revision, committed.revision);
  assert.equal(changes, 1);
  await assert.rejects(service.command('preview.draft', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'camera.update', settings: { x: 0.4 } }] }), { code: 'REVISION_CONFLICT' });
  const undone = await service.command('history.undo', { projectId: p.id, expectedRevision: committed.revision });
  assert.deepEqual(undone.edits, p.edits);
});

test('cancellation reload follows a queued draft behind an unrelated long mutation', async t => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const loads: number[] = [];
  const { service } = await setup(t, async (method, params) => {
    if (method === 'permissions.request') { entered(); await gate; return {}; }
    if (method === 'preview.load') { loads.push((params!.project as Project).edits.camera.x); return {}; }
    throw Error(method);
  });
  const p = await ready(service);
  await service.command('preview.load', { projectId: p.id });
  const mutation = service.command('permissions.request', { kind: 'input' });
  await started;
  let reads = 0;
  const get = service.store.get.bind(service.store);
  service.store.get = projectId => { reads++; return get(projectId); };
  const draft = service.command('preview.draft', { projectId: p.id, expectedRevision: p.revision, operations: [{ type: 'camera.update', settings: { x: 0.1 } }] });
  const cancelled = service.command('preview.load', { projectId: p.id });
  const readsWhileBlocked = reads;
  release();
  await Promise.all([mutation, draft, cancelled]);
  assert.equal(readsWhileBlocked, 0);
  assert.deepEqual(loads, [p.edits.camera.x, 0.1, p.edits.camera.x]);
  assert.deepEqual(await service.store.get(p.id), p);
});

for (const provider of ['openai','anthropic'] as const) test(`${provider} mocked tool cycle stages edits and commits exactly one undo group`,async t=>{
  const {service}=await setup(t,async method=>{if(method==='keychain.get') return {key:'test-key-not-real'};throw new Error(method);});
  const original=await ready(service); let step=0;
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async (url,options)=>{
    const input=JSON.parse(String(options!.body)); assert(String(url).startsWith(provider==='openai'?'https://api.openai.com/':'https://api.anthropic.com/'));
    if(step===0) assert(JSON.stringify(input.tools).includes('silence_analyze'));
    const operation=step===0?{type:'camera.update',settings:{visible:false}}:{type:'captions.update',settings:{enabled:true}};
    const args={expectedRevision:original.revision+step,operations:[operation]};
    const content=step<2 ? provider==='openai'?[{type:'function_call',name:'timeline_apply',call_id:`call${step}`,arguments:JSON.stringify(args)}]:[{type:'tool_use',name:'timeline_apply',id:`call${step}`,input:args}] : provider==='openai'?[{type:'message',content:[{type:'output_text',text:'Done'}]}]:[{type:'text',text:'Done'}];
    step++; return Response.json(provider==='openai'?{output:content}:{content});
  };
  const job:Job=await service.command('ai.assistant',{projectId:original.id,prompt:'Hide camera and add captions',provider});
  const done=await waitJob(service,job.id); assert.equal(done.status,'completed',done.error);
  const edited=await service.store.get(original.id); assert.equal(edited.revision,original.revision+1); assert.equal(edited.edits.camera.visible,false); assert.equal(edited.edits.captions.enabled,true);
  const undone=await service.command('history.undo',{projectId:original.id,expectedRevision:edited.revision}); assert.deepEqual(undone.edits,original.edits);
});

test('AI provider failure leaves staged changes uncommitted and API keys out of project storage',async t=>{
  const {service,root}=await setup(t,async method=>{if(method==='keychain.get') return {key:'test-key-not-real'};throw new Error(method);});
  const original=await ready(service); let step=0; const originalFetch=globalThis.fetch; t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async()=>step++===0?Response.json({output:[{type:'function_call',name:'timeline_apply',call_id:'call',arguments:JSON.stringify({expectedRevision:original.revision,operations:[{type:'camera.update',settings:{visible:false}}]})}]}):Response.json({error:{message:'Quota exhausted'}},{status:429});
  const job=await service.command('ai.assistant',{projectId:original.id,prompt:'Hide camera'}); const result=await waitJob(service,job.id);
  assert.equal(result.status,'failed'); assert.match(result.error!,/429/); assert.deepEqual(await service.store.get(original.id),original);
  assert(!(await fs.readFile(path.join(service.store.dir(original.id),'project.json'),'utf8')).includes('test-key-not-real'));
  assert(!(await fs.readFile(path.join(root,'data','jobs.json'),'utf8')).includes('test-key-not-real'));
});
