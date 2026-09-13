// Requires an already running desktop app using this repository's isolated .cache data directory.
// ffmpeg/ffprobe are test-fixture tools only; they are not product runtime dependencies.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Job, Project, TranscriptSegment } from '../shared/types.js';
import { duration } from '../shared/timeline.js';
import { hashFile, models } from '../server/ai.js';

const dataDir = path.resolve(process.env.SCREENREC_DATA_DIR || '');
assert(process.env.SCREENREC_DATA_DIR && dataDir.startsWith(path.resolve('.cache') + path.sep), 'Run against an isolated SCREENREC_DATA_DIR inside this repository’s .cache directory.');
const video = path.resolve(process.argv[2] || '');
assert(process.argv[2] && (await fs.stat(video)).isFile(), 'Pass a synthetic test video path.');
const speech = path.resolve(process.argv[3] || '.cache/local-ai-check/speech.wav');
const cachedModel = path.resolve('.cache/local-ai-check/models/ggml-base.bin');
assert.equal(await hashFile(cachedModel), models.find(m => m.id === 'base')!.sha256, 'Prepare a verified Base model with npm run test:ai first.');
await fs.mkdir(path.join(dataDir, 'models'), { recursive: true });
const installedModel = path.join(dataDir, 'models/ggml-base.bin');
await fs.link(cachedModel, installedModel).catch(async (error: NodeJS.ErrnoException) => {
  if (error.code === 'EEXIST') return;
  if (error.code !== 'EXDEV') throw error;
  await fs.copyFile(cachedModel, installedModel, constants.COPYFILE_EXCL);
});
assert.equal(await hashFile(installedModel), models.find(m => m.id === 'base')!.sha256);
const artifacts = await fs.mkdtemp(path.resolve('.cache/desktop-ai-check-'));
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', speech], { encoding: 'utf8' }));
const speechSeconds = Number(probe.format.duration);
assert(Number.isFinite(speechSeconds) && speechSeconds > 2);
const fixture = path.join(artifacts, 'speech-fixture.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-stream_loop', '-1', '-i', video, '-i', speech, '-filter_complex', '[0:v]drawbox=x=0:y=ih*0.75:w=iw:h=ih*0.25:color=0x18201a:t=fill[v];[1:a]adelay=2000:all=1[a]', '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-t', String(speechSeconds + 2), '-movflags', '+faststart', fixture], { stdio: 'inherit' });

const client = new Client({ name: 'desktop-local-ai-acceptance', version: '1.0.0' });
const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
const runningJobs = new Set<string>();
const resources = path.resolve(process.env.SCREENREC_RESOURCES || 'resources');
await client.connect(new StdioClientTransport({ command: path.join(resources, 'bin/node'), args: [path.join(resources, 'mcp.mjs')], env, stderr: 'inherit' }));
async function call<T = any>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await client.callTool({ name: method.replace(/[./]/g, '_'), arguments: args });
  assert(!response.isError, `${method}: ${JSON.stringify(response.content)}`);
  return (response.structuredContent as { result: T }).result;
}
async function finish(job: Job) {
  runningJobs.add(job.id);
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const state = await call<Job>('jobs.get', { jobId: job.id });
    if (state.status === 'completed') { runningJobs.delete(job.id); return state; }
    assert(!['failed', 'cancelled'].includes(state.status), JSON.stringify(state));
    await delay(250);
  }
  throw new Error('Desktop local-AI job exceeded three minutes.');
}
function subtitleRanges(text: string) {
  const time = (hours: string, minutes: string, seconds: string, milliseconds: string) => Number(hours) * 3_600_000 + Number(minutes) * 60_000 + Number(seconds) * 1000 + Number(milliseconds);
  return [...text.matchAll(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3}) --> (\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g)].map(m => ({ startMs: time(m[1], m[2], m[3], m[4]), endMs: time(m[5], m[6], m[7], m[8]) }));
}

try {
  assert((await call('app.capabilities')).nativeAvailable);
  let project = await call<Project>('project.import', { path: fixture, name: 'Local AI acceptance fixture' });
  assert(project.source?.microphone, 'Import must expose the audio track for native speech extraction.');
  await finish(await call<Job>('ai.transcribe', { projectId: project.id, model: 'base', language: 'en' }));
  project = await call<Project>('project.open', { projectId: project.id });
  const original: TranscriptSegment[] = structuredClone(project.transcript);
  assert(original.length > 0 && original.every(segment => segment.startMs >= 0 && segment.endMs > segment.startMs && segment.endMs <= project.source!.durationMs));
  const text = original.map(segment => segment.text).join(' ');
  assert.match(text.toLowerCase(), /screen/);
  assert.match(text.toLowerCase(), /project/);
  assert(project.edits.captions.enabled, 'Transcription should enable captions.');
  const initialDuration = duration(project.edits.segments), cutMs = 1000;
  project = await call<Project>('timeline.apply', { projectId: project.id, expectedRevision: project.revision, operations: [{ type: 'cut', startMs: 0, endMs: cutMs }] });
  assert.equal(duration(project.edits.segments), initialDuration - cutMs);
  assert.deepEqual(project.transcript, original, 'Cuts must preserve source-time transcript segments.');
  const expected = original.filter(segment => segment.endMs > cutMs).map(segment => ({ startMs: Math.round(Math.max(0, segment.startMs - cutMs)), endMs: Math.round(segment.endMs - cutMs) }));
  for (const format of ['srt', 'vtt']) {
    const output = path.join(artifacts, `shifted-captions.${format}`);
    const result = await call<{ text: string; path: string }>('transcript.export', { projectId: project.id, format, path: output });
    assert.deepEqual(subtitleRanges(result.text), expected, `${format} timestamps must shift after removing the first second.`);
    assert.equal(await fs.readFile(output, 'utf8'), result.text);
    if (format === 'vtt') assert(result.text.startsWith('WEBVTT'));
  }
  await call('preview.load', { projectId: project.id });
  const frame = await client.callTool({ name: 'preview_frame', arguments: { projectId: project.id, timeMs: Math.min(duration(project.edits.segments) - 1, expected[0].startMs + 800) } });
  const content = frame.content;
  assert(!frame.isError && Array.isArray(content), 'Native caption composition should return a preview image through MCP.');
  const image = content.find(item => item.type === 'image');
  assert(image?.type === 'image' && typeof image.data === 'string');
  const preview = path.join(artifacts, 'caption-preview.png');
  await fs.writeFile(preview, Buffer.from(image.data, 'base64'));
  const pixels = execFileSync('ffmpeg', ['-v', 'error', '-i', preview, '-vf', 'crop=iw*0.8:ih*0.2:iw*0.1:ih*0.75,format=rgb24', '-f', 'rawvideo', '-'], { maxBuffer: 8_000_000 });
  let lightPixels = 0;
  for (let i = 0; i + 2 < pixels.length; i += 3) if (pixels[i] > 215 && pixels[i + 1] > 215 && pixels[i + 2] > 215) lightPixels++;
  assert(lightPixels > 20, `Caption preview has no visible white glyphs (${lightPixels} light pixels). Inspect ${preview}.`);
  await fs.writeFile(path.join(artifacts, 'result.json'), JSON.stringify({ projectId: project.id, name: project.name, sourceTranscript: original, editedCaptions: expected, removedMs: cutMs }, null, 2));
  console.log(`DESKTOP_AI_JOBS_FINISHED: ${project.id}`);
  console.log(`Desktop local AI passed: native audio preparation → bundled Whisper Base → ${original.length} timed segments; source transcript preserved after cut; shifted SRT/VTT; native caption preview image.\nTranscript: ${text}\nProject kept: ${project.name}\nArtifacts: ${artifacts}`);
} finally {
  for (const jobId of runningJobs) await call('jobs.cancel', { jobId }).catch(() => {});
  await client.close();
}
