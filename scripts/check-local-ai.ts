import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { LocalAI } from "@/server/services/ai.js";

const directory = path.resolve(".cache/local-ai-check");
await mkdir(directory, { recursive: true });
const ai = new LocalAI(path.join(directory, "models"), path.resolve("resources/bin/whisper-cli"));
const signal = new AbortController().signal;
let lastBucket = -1;
await ai.download("base", signal, (fraction, message) => {
  const bucket = Math.floor(fraction * 10);
  if (bucket !== lastBucket) {
    lastBucket = bucket;
    console.log(message);
  }
});
for (const sample of [
  {
    language: "en",
    voice: "Daniel",
    speech:
      "Welcome to Screen Recorder. Create a project, record your screen, and edit your video.",
    words: [/screen/, /project/],
  },
  {
    language: "tr",
    voice: "Yelda",
    speech: "Merhaba. Ekran kaydedici ile bir proje oluşturun ve videonuzu düzenleyin.",
    words: [/merhaba/, /ekran/],
  },
] as const) {
  const original = path.join(directory, `speech-${sample.language}.aiff`);
  const audio = path.join(directory, `speech-${sample.language}.wav`);
  execFileSync("/usr/bin/say", ["-v", sample.voice, "-o", original, sample.speech]);
  execFileSync("/usr/bin/afconvert", [
    "-f",
    "WAVE",
    "-d",
    "LEI16@16000",
    "-c",
    "1",
    original,
    audio,
  ]);
  const segments = await ai.transcribe(
    "base",
    audio,
    path.join(directory, `transcript-${sample.language}`),
    sample.language,
    signal,
    () => {},
  );
  assert.ok(segments.length > 0, `${sample.language}: expected timed transcript segments.`);
  assert.ok(
    segments.every((segment) => segment.endMs > segment.startMs && segment.startMs >= 0),
    `${sample.language}: timestamps must be ordered positive intervals.`,
  );
  const text = segments.map((segment) => segment.text).join(" ");
  for (const word of sample.words) assert.match(text.toLocaleLowerCase(sample.language), word);
  console.log(`${sample.language.toUpperCase()} local transcription passed: ${text}`);
}
