import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bibtexFor, bibliographyFor } from '../js/citation.js';

const ds = {
  id: 'dabc1234',
  title: 'World Development Indicators {2024} & more',
  source: 'World Bank',
  url: 'https://data.worldbank.org/wdi',
  license: 'CC BY 4.0',
  freshnessYear: 2026,
  coverageStart: 1960,
  coverageEnd: 2025,
};

test('bibtexFor emits a parseable @misc entry with escaped fields', () => {
  const bib = bibtexFor(ds, '2026-07-10');
  assert.ok(bib.startsWith('@misc{atlas_worldbank_2026_'));
  assert.ok(bib.includes('title        = {World Development Indicators 2024 \\& more}'));
  assert.ok(bib.includes('author       = {{World Bank}}'));
  assert.ok(bib.includes('\\url{https://data.worldbank.org/wdi}'));
  assert.ok(bib.includes('accessed 2026-07-10'));
  assert.ok(!/[{][^}]*[{]/.test(bib.split('\n')[1]), 'no nested braces from title');
});

test('bibliographyFor joins entries with blank lines', () => {
  const two = bibliographyFor([ds, { ...ds, id: 'dxyz9999', title: 'Other' }], '2026-07-10');
  assert.equal(two.split('@misc').length - 1, 2);
  assert.ok(two.endsWith('\n'));
});
