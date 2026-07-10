import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeState, parseState } from '../js/url-state.js';
import { SOURCE_TYPE_META } from '../js/config.js';

const baseState = () => ({
  domain: 'all',
  region: null,
  focusCountry: null,
  search: '',
  minOpenness: 0,
  sourceTypes: new Set(Object.keys(SOURCE_TYPE_META)),
  formats: new Set(['CSV', 'API']),
  sort: 'freshness',
  projection: 'globe',
});

test('default state serializes to an empty hash', () => {
  assert.equal(serializeState(baseState(), ['CSV', 'API']), '');
});

test('round-trip: serialize then parse restores the same view', () => {
  const s = {
    ...baseState(),
    domain: 'climate',
    region: 'asia',
    focusCountry: 'IN',
    search: 'rain fall',
    minOpenness: 0.6,
    sort: 'coverage',
    projection: 'flat',
  };
  const parsed = parseState('#' + serializeState(s, ['CSV', 'API']));
  assert.equal(parsed.domain, 'climate');
  assert.equal(parsed.region, 'asia');
  assert.equal(parsed.focusCountry, 'IN');
  assert.equal(parsed.search, 'rain fall');
  assert.equal(parsed.minOpenness, 0.6);
  assert.equal(parsed.sort, 'coverage');
  assert.equal(parsed.projection, 'flat');
});

test('parse rejects junk values instead of importing them', () => {
  const parsed = parseState('#d=astrology&r=atlantis&c=india&o=9&srt=chaos&v=hologram&p=<script>');
  assert.deepEqual(parsed, {});
});

test('narrowed source types survive the round trip', () => {
  const s = { ...baseState(), sourceTypes: new Set(['kaggle', 'research']) };
  const parsed = parseState('#' + serializeState(s, ['CSV', 'API']));
  assert.deepEqual(parsed.sourceTypes.sort(), ['kaggle', 'research']);
});

test('an all-junk formats param is dropped rather than clearing every format', () => {
  const parsed = parseState('#f=123.!!.');
  assert.equal(parsed.formats, undefined);
});

test('urls with quote/angle characters are rejected by the catalog sanitizer', async () => {
  const { sanitizeEntry } = await import('../js/catalog.js');
  const valid = {
    title: 'T', description: '', domain: 'climate', region: 'asia',
    source: 'S', sourceType: 'kaggle', formats: ['CSV'], license: 'CC0',
    licenseOpenness: 1, freshnessYear: 2024, coverageStart: 2000,
    coverageEnd: 2024, granularity: 'country', approxSizeMB: 1,
  };
  assert.equal(sanitizeEntry({ ...valid, url: 'https://x.com/a"onmouseover="alert(1)' }), null);
  assert.equal(sanitizeEntry({ ...valid, url: "https://x.com/a'b" }), null);
  assert.equal(sanitizeEntry({ ...valid, url: 'https://x.com/<svg>' }), null);
  assert.ok(sanitizeEntry({ ...valid, url: 'https://x.com/ok?a=1&b=2#frag' }));
});

test('non-conforming catalog ids are regenerated, not trusted', async () => {
  const { buildCatalog } = await import('../js/catalog.js');
  const entry = {
    id: 'x" onmouseover="alert(1)',
    title: 'T', description: '', domain: 'climate', region: 'asia',
    source: 'S', sourceType: 'kaggle', url: 'https://x.com/ok', formats: ['CSV'],
    license: 'CC0', licenseOpenness: 1, freshnessYear: 2024,
    coverageStart: 2000, coverageEnd: 2024, granularity: 'country', approxSizeMB: 1,
  };
  const [d] = buildCatalog({ datasets: [entry] });
  assert.match(d.id, /^d[a-z0-9]+$/);
});

test('pin ids parse only in the expected shape', () => {
  const parsed = parseState('#p=dabc123.dxyz789.junk!id');
  assert.deepEqual(parsed.pins, ['dabc123', 'dxyz789']);
});
