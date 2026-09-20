import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordSourceModifiedYear } from '../js/catalog-metadata.js';

test('source API updates never alter the reviewed data timeline', () => {
  const entry = { freshnessYear: 2020, coverageEnd: 2019 };
  assert.equal(recordSourceModifiedYear(entry, 2025, 2026), true);
  assert.deepEqual(entry, {
    freshnessYear: 2020,
    coverageEnd: 2019,
    sourceModifiedYear: 2025,
  });
  assert.equal(recordSourceModifiedYear(entry, 2025, 2026), false);
  assert.equal(recordSourceModifiedYear(entry, 2027, 2026), false);
});
