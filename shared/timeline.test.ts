import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duration, sourceTime, timelineTime, sourceRanges, subtractRanges } from './timeline.js';

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
