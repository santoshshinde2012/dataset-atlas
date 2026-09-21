import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cross = JSON.parse(readFileSync(new URL('../data/india-district-subdivision.json', import.meta.url)));
const norm = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const lookup = (state, district) =>
  cross.byDistrict[`${norm(state)}|${norm(district)}`] || cross.byState[norm(state)] || null;

test('sample crop rows all resolve to an IMD subdivision', () => {
  const text = readFileSync(new URL('../data/samples/india-crop-sample.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  for (const line of text) {
    const [state, district] = line.split(',');
    assert.ok(lookup(state, district), `${state} ${district}`);
  }
  assert.equal(lookup('Maharashtra', 'Pune'), 'Madhya Maharashtra');
  assert.equal(lookup('Maharashtra', 'Nagpur'), 'Vidarbha');
  assert.equal(lookup('Kerala', 'Thiruvananthapuram'), 'Kerala');
});
