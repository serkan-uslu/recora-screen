import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { LocalAI } from '../server/services/ai.js';

const directory = path.resolve('.cache/local-ai-check');
await mkdir(directory, { recursive: true });
const ai = new LocalAI(path.join(directory, 'models'), path.resolve('resources/bin/whisper-cli'));
const signal = new AbortController().signal;
let lastBucket = -1;
await ai.download('base', signal, (fraction, message) => {
  const bucket = Math.floor(fraction * 10);
  if (bucket !== lastBucket) { lastBucket = bucket; console.log(message); }
});
const original = path.join(directory, 'speech.aiff');
const audio = path.join(directory, 'speech.wav');
execFileSync('/usr/bin/say', ['-o', original, 'Welcome to Screen Recorder. Create a project, record your screen, and edit your video. Your recordings stay on your computer.']);
execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', original, audio]);
const segments = await ai.transcribe('base', audio, path.join(directory, 'transcript'), 'en', signal, () => {});
assert.ok(segments.length > 0, 'The real Whisper binary should produce timed transcript segments.');
assert.ok(segments.every(s => s.endMs > s.startMs && s.startMs >= 0), 'Timestamps should be ordered positive intervals.');
const text = segments.map(s => s.text).join(' ');
assert.match(text.toLowerCase(), /screen/);
assert.match(text.toLowerCase(), /project/);
console.log(`Local speech transcription passed: ${text}`);
