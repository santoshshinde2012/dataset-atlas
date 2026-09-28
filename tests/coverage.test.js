import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferCoverageKind, countryCoverage, seriesObservation } from '../js/coverage.js';

test('tagged countries win over series inference', () => {
  const d = { countries: ['IN'], region: 'global', granularity: 'country', source: 'World Bank', url: 'https://data.worldbank.org/indicator/X' };
  assert.equal(inferCoverageKind(d), 'tagged-countries');
  assert.equal(countryCoverage(d, 'IN'), 'tagged');
  assert.equal(countryCoverage(d, 'BR'), null);
});

test('global World Bank country series is a candidate, not a tag', () => {
  const d = { countries: [], region: 'global', granularity: 'country', source: 'World Bank Open Data', url: 'https://data.worldbank.org/indicator/SP.POP.TOTL' };
  assert.equal(inferCoverageKind(d), 'global-country-series');
  assert.equal(countryCoverage({ ...d, coverageKind: 'global-country-series' }, 'IN'), 'series');
});

test('checked coverage distinguishes observed rows from a confirmed absence', () => {
  const dataset = { url: 'https://example.org/pop' };
  const index = { series: { 'https://example.org/pop': { IN: [1960, 2023] } } };
  assert.deepEqual(seriesObservation(index, dataset, 'IN'), { start: 1960, end: 2023 });
  assert.equal(seriesObservation(index, dataset, 'BR'), 'absent');
  assert.equal(seriesObservation(index, { url: 'https://example.org/other' }, 'IN'), null);
});
