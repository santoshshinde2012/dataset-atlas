import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dnaMetrics } from '../js/dna.js';

const ds = {
  freshnessYear: 2024, coverageStart: 1960, coverageEnd: 2024,
  granularity: 'point', approxSizeMB: 100, licenseOpenness: 0.8, license: 'CC BY',
};

test('returns five bars, each normalized to (0, 1]', () => {
  const bars = dnaMetrics(ds);
  assert.equal(bars.length, 5);
  assert.deepEqual(bars.map((b) => b.label), ['FRS', 'COV', 'GRN', 'SIZ', 'LIC']);
  for (const b of bars) {
    assert.ok(b.value > 0 && b.value <= 1, `${b.label} out of range: ${b.value}`);
    assert.ok(b.tip.length > 5);
  }
});

test('fresher data scores higher', () => {
  const fresh = dnaMetrics({ ...ds, freshnessYear: 2026 })[0].value;
  const stale = dnaMetrics({ ...ds, freshnessYear: 2010 })[0].value;
  assert.ok(fresh > stale);
});

test('unknown granularity falls back without crashing', () => {
  const bars = dnaMetrics({ ...ds, granularity: 'quantum' });
  assert.equal(bars[2].value, 0.3);
});

test('degenerate entries stay in range', () => {
  const bars = dnaMetrics({ license: 'x' });
  for (const b of bars) assert.ok(b.value >= 0.08 && b.value <= 1);
});
