import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIdentifier, classifyIdentifiers, dropAggregateRows, isCountryIso3, iso3For, IDENTIFIER_NOTE,
} from '../js/identifiers.js';

test('ISO-2 and ISO-3 countries round-trip; aggregates are dropped', () => {
  assert.equal(iso3For('in'), 'IND');
  assert.equal(classifyIdentifier('IN').status, 'country');
  assert.equal(classifyIdentifier('IND').iso2, 'IN');
  assert.equal(classifyIdentifier('WLD').drop, true);
  assert.equal(classifyIdentifier('EUU').kind, 'world-bank');
  assert.equal(classifyIdentifier('OWID_WRL').drop, true);
  assert.equal(classifyIdentifier('World').drop, true);
  assert.equal(classifyIdentifier('SAS').drop, true);
  assert.equal(isCountryIso3('IND'), true);
  assert.equal(isCountryIso3('WLD'), false);
  assert.match(IDENTIFIER_NOTE, /OWID_WRL/);
});

test('dropAggregateRows keeps India and drops world totals', () => {
  const kept = dropAggregateRows([
    { iso_code: 'IND', country: 'India' },
    { iso_code: 'OWID_WRL', country: 'World' },
    { iso_code: 'WLD', country: 'World' },
    { iso_code: '', country: 'Africa' },
  ]);
  assert.deepEqual(kept.map((r) => r.iso_code), ['IND']);
  const batch = classifyIdentifiers(['NG', 'XKX']);
  assert.equal(batch[0].iso3, 'NGA');
  assert.equal(batch[1].status, 'country');
});
