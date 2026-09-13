import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duration, sourceTime, timelineTime, sourceRanges, subtractRanges, sliceSegments, outputRanges, outputSize } from './timeline.js';
import { defaultEdits, type Project } from './types.js';

test('source mapping preserves all synchronized tracks across cuts and boundaries', () => {
  const segments = [{ startMs: 0, endMs: 1000 }, { startMs: 3000, endMs: 6000 }];
  assert.equal(duration(segments), 4000);
  assert.equal(sourceTime(segments, 1000), 3000);
  assert.equal(sourceTime(segments, 4000), 6000);
  assert.equal(timelineTime(segments, 2000), null);
  assert.equal(timelineTime(segments, 4000), 2000);
  assert.deepEqual(sourceRanges(segments, 500, 2000), [{ startMs: 500, endMs: 1000 }, { startMs: 3000, endMs: 4000 }]);
  assert.deepEqual(subtractRanges(segments, sourceRanges(segments, 500, 2000)), [{ startMs: 0, endMs: 500 }, { startMs: 4000, endMs: 6000 }]);
});

test('mixed playback speeds map both directions and retain speeds through range edits', () => {
  const segments = [{ startMs: 0, endMs: 1000, speed: 0.5 }, { startMs: 3000, endMs: 7000, speed: 2 }];
  assert.equal(duration(segments), 4000);
  assert.equal(sourceTime(segments, 1000), 500);
  assert.equal(sourceTime(segments, 2000), 3000);
  assert.equal(sourceTime(segments, 4000), 7000);
  assert.equal(timelineTime(segments, 4000), 2500);
  assert.equal(timelineTime(segments, 2000), null);
  assert.deepEqual(sourceRanges(segments, 1000, 3000), [{ startMs: 500, endMs: 1000 }, { startMs: 3000, endMs: 5000 }]);
  assert.deepEqual(sliceSegments(segments, 1000, 3000), [{ startMs: 500, endMs: 1000, speed: 0.5 }, { startMs: 3000, endMs: 5000, speed: 2 }]);
  assert.deepEqual(subtractRanges(segments, [{ startMs: 250, endMs: 750 }]), [{ startMs: 0, endMs: 250, speed: 0.5 }, { startMs: 750, endMs: 1000, speed: 0.5 }, segments[1]]);
  assert.deepEqual(outputRanges(segments, { startMs: 500, endMs: 5000 }), [{ startMs: 1000, endMs: 2000 }, { startMs: 2000, endMs: 3000 }]);
  const fractional = Array.from({ length: 100 }, (_, i) => ({ startMs: i * 1000, endMs: (i + 1) * 1000, speed: 0.25 + i * 0.073 }));
  assert.deepEqual(sliceSegments(fractional, 0, duration(fractional)), fractional);
});

test('canvas dimensions support portrait, square, 720p, 4K and legacy source aspect', () => {
  const project = { edits: defaultEdits(), source: { width: 1600, height: 1200 } } as Project;
  assert.deepEqual(outputSize(project), { width: 1920, height: 1080 });
  project.edits.canvas!.aspectRatio = '9:16';
  assert.deepEqual(outputSize(project, '4k'), { width: 2160, height: 3840 });
  project.edits.canvas!.aspectRatio = '1:1';
  assert.deepEqual(outputSize(project), { width: 1080, height: 1080 });
  project.edits.canvas!.aspectRatio = '4:5';
  assert.deepEqual(outputSize(project, '720'), { width: 720, height: 900 });
  delete project.edits.canvas;
  assert.deepEqual(outputSize(project), { width: 1920, height: 1440 });
});
