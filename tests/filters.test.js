import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesFacets, filterCatalog, regionCounts, domainCounts } from '../js/filters.js';

const mk = (over = {}) => ({
  title: 'T', description: 'D', source: 'S',
  domain: 'climate', region: 'asia', sourceType: 'kaggle',
  formats: ['CSV'], licenseOpenness: 0.8,
  ...over,
});

const stateAll = {
  domain: 'all',
  sourceTypes: new Set(['kaggle', 'intl-org']),
  formats: new Set(['CSV', 'API']),
  minOpenness: 0,
  search: '',
};

test('matchesFacets applies every facet', () => {
  assert.ok(matchesFacets(mk(), stateAll));
  assert.ok(!matchesFacets(mk({ domain: 'health' }), { ...stateAll, domain: 'climate' }));
  assert.ok(!matchesFacets(mk({ sourceType: 'ngo' }), stateAll));
  assert.ok(!matchesFacets(mk({ formats: ['Shapefile'] }), stateAll));
  assert.ok(!matchesFacets(mk({ licenseOpenness: 0.2 }), { ...stateAll, minOpenness: 0.8 }));
  assert.ok(!matchesFacets(mk(), { ...stateAll, search: 'nomatch' }));
  assert.ok(matchesFacets(mk({ title: 'Air Quality' }), { ...stateAll, search: 'air qual' }));
});

test('format facet normalizes raw labels before matching', () => {
  assert.ok(matchesFacets(mk({ formats: ['tsv'] }), stateAll)); // tsv → CSV bucket
});

test('ignore list enables faceted counting', () => {
  const d = mk({ sourceType: 'ngo' });
  assert.ok(!matchesFacets(d, stateAll));
  assert.ok(matchesFacets(d, stateAll, ['source']));
});

test('filterCatalog + counts', () => {
  const catalog = [
    mk(), mk({ region: 'europe' }), mk({ region: 'global', domain: 'health' }),
    mk({ sourceType: 'ngo' }), // filtered out
  ];
  const kept = filterCatalog(catalog, stateAll);
  assert.equal(kept.length, 3);
  const rc = regionCounts(kept);
  assert.equal(rc.asia, 1);
  assert.equal(rc.europe, 1);
  assert.equal(rc.global, 1);
  assert.equal(rc.africa, 0);
  const dc = domainCounts(kept);
  assert.equal(dc.climate, 2);
  assert.equal(dc.health, 1);
});

test('entries with unknown regions are not counted', () => {
  const rc = regionCounts([mk({ region: 'mars' })]);
  assert.equal(Object.values(rc).reduce((a, b) => a + b, 0), 0);
});
