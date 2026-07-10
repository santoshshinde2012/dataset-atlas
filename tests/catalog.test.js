import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEntry, buildCatalog } from '../js/catalog.js';

const valid = {
  title: 'Test Dataset',
  description: 'desc',
  domain: 'climate',
  region: 'asia',
  source: 'Kaggle',
  sourceType: 'kaggle',
  url: 'https://www.kaggle.com/datasets/owner/slug',
  kaggleRef: 'owner/slug',
  formats: ['CSV'],
  license: 'CC0',
  licenseOpenness: 1,
  freshnessYear: 2024,
  coverageStart: 2000,
  coverageEnd: 2024,
  granularity: 'country',
  approxSizeMB: 5,
};

test('sanitizeEntry accepts a well-formed entry unchanged in essentials', () => {
  const e = sanitizeEntry(valid);
  assert.equal(e.title, valid.title);
  assert.equal(e.kaggleRef, 'owner/slug');
  assert.deepEqual(e.formats, ['CSV']);
});

test('sanitizeEntry rejects unusable entries', () => {
  assert.equal(sanitizeEntry(null), null);
  assert.equal(sanitizeEntry({ ...valid, url: 'javascript:alert(1)' }), null);
  assert.equal(sanitizeEntry({ ...valid, url: 'ftp://x' }), null);
  assert.equal(sanitizeEntry({ ...valid, domain: 'astrology' }), null);
  assert.equal(sanitizeEntry({ ...valid, region: 'atlantis' }), null);
});

test('sanitizeEntry accepts the global pseudo-region', () => {
  assert.ok(sanitizeEntry({ ...valid, region: 'global' }));
});

test('sanitizeEntry normalizes malformed fields instead of crashing', () => {
  const e = sanitizeEntry({ ...valid, formats: null, licenseOpenness: 9, approxSizeMB: -3, sourceType: 'wat' });
  assert.deepEqual(e.formats, ['Other']);
  assert.equal(e.licenseOpenness, 1);
  assert.equal(e.approxSizeMB, 0.1);
  assert.equal(e.sourceType, 'research');
});

test('sanitizeEntry rejects URLs with embedded whitespace or control characters', () => {
  assert.equal(sanitizeEntry({ ...valid, url: 'https://example.com/a\nrm -rf ~' }), null);
  assert.equal(sanitizeEntry({ ...valid, url: 'https://example.com/a b' }), null);
  // non-whitespace control bytes (terminal escape injection) are rejected too
  assert.equal(sanitizeEntry({ ...valid, url: 'https://example.com/\x1b]0;owned\x07data.csv' }), null);
  assert.equal(sanitizeEntry({ ...valid, url: 'https://example.com/a\x7fb' }), null);
  // fragments are legitimate
  assert.equal(sanitizeEntry({ ...valid, url: 'https://www.fao.org/faostat/en/#data/QCL' }).url,
    'https://www.fao.org/faostat/en/#data/QCL');
  // leading/trailing whitespace is tolerated and trimmed
  assert.equal(sanitizeEntry({ ...valid, url: '  https://example.com/ok  ' }).url, 'https://example.com/ok');
});

test('sanitizeEntry strips control characters from display strings', () => {
  const e = sanitizeEntry({ ...valid, title: 'Nice\ntitle\x00!', source: 'A\rB', license: 'MIT\x1f' });
  assert.ok(!/[\x00-\x1f\x7f]/.test(e.title + e.source + e.license));
  assert.equal(e.title, 'Nice title !');
});

test('sanitizeEntry strips shell-unsafe kaggleRef', () => {
  const e = sanitizeEntry({ ...valid, kaggleRef: 'owner/slug; rm -rf ~' });
  assert.equal(e.kaggleRef, undefined);
  const e2 = sanitizeEntry({ ...valid, kaggleRef: 'owner/$(whoami)' });
  assert.equal(e2.kaggleRef, undefined);
});

test('buildCatalog filters invalid entries and assigns stable ids', () => {
  const catalog = buildCatalog({ datasets: [valid, { junk: true }, { ...valid, url: 'https://other.example/x' }] });
  assert.equal(catalog.length, 2);
  assert.ok(catalog.every((d) => typeof d.id === 'string' && d.id.length > 1));
  assert.notEqual(catalog[0].id, catalog[1].id);
});
