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
  assert.equal(e.landingPage, valid.url);
  assert.deepEqual(e.resources, []);
});

test('source metadata stays separate from the reviewed dataset year', () => {
  const currentYear = new Date().getUTCFullYear();
  const e = sanitizeEntry({ ...valid, sourceModifiedYear: currentYear });
  assert.equal(e.sourceModifiedYear, currentYear);
  assert.equal(e.freshnessYear, 2024);
  assert.equal(e.coverageEnd, 2024);
  assert.equal(sanitizeEntry({ ...valid, sourceModifiedYear: '2026' }).sourceModifiedYear, undefined);
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

test('sanitizeEntry validates optional country tags', () => {
  assert.deepEqual(sanitizeEntry({ ...valid, countries: ['IN', 'BR'] }).countries, ['IN', 'BR']);
  assert.deepEqual(sanitizeEntry({ ...valid }).countries, []);
  assert.deepEqual(sanitizeEntry({ ...valid, countries: ['india', 'I', 'IN1', '<b>'] }).countries, []);
  assert.equal(sanitizeEntry({ ...valid, countries: ['A1', 'B2', 'IN', 'BR', 'US', 'AU', 'NZ'] }).countries.length <= 4, true);
});

test('buildCatalog filters invalid entries and assigns stable ids', () => {
  const catalog = buildCatalog({ datasets: [valid, { junk: true }, { ...valid, url: 'https://other.example/x' }] });
  assert.equal(catalog.length, 2);
  assert.ok(catalog.every((d) => typeof d.id === 'string' && d.id.length > 1));
  assert.notEqual(catalog[0].id, catalog[1].id);
});

test('sanitizeEntry keeps only safe resources and infers coverage kind', () => {
  const e = sanitizeEntry({
    ...valid,
    region: 'global',
    source: 'World Bank Open Data',
    resources: [
      { url: 'https://api.worldbank.org/v2/en/indicator/X?downloadformat=csv', kind: 'download', format: 'CSV', label: 'CSV' },
      { url: 'javascript:alert(1)', kind: 'download' },
    ],
  });
  assert.equal(e.resources.length, 1);
  assert.equal(e.coverageKind, 'global-country-series');
});

test('sanitizeEntry keeps a safe licenseUrl and drops a bad one', () => {
  const ok = sanitizeEntry({ ...valid, licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' });
  assert.equal(ok.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
  const bad = sanitizeEntry({ ...valid, licenseUrl: 'javascript:alert(1)' });
  assert.equal(bad.licenseUrl, undefined);
});

test('publication year and free access require explicit valid metadata', () => {
  const e = sanitizeEntry({ ...valid, publicationYear: 2024, isAccessibleForFree: false });
  assert.equal(e.publicationYear, 2024);
  assert.equal(e.isAccessibleForFree, false);
  for (const publicationYear of ['2024', 1700, 9999, null]) {
    assert.equal(sanitizeEntry({ ...valid, publicationYear }).publicationYear, undefined);
  }
  assert.equal(sanitizeEntry({ ...valid, isAccessibleForFree: 'true' }).isAccessibleForFree, undefined);
});

test('registry fields must name own entries rather than inherited object properties', () => {
  for (const key of ['constructor', 'toString', '__proto__']) {
    assert.equal(sanitizeEntry({ ...valid, domain: key }), null);
    assert.equal(sanitizeEntry({ ...valid, region: key }), null);
    assert.equal(sanitizeEntry({ ...valid, sourceType: key }).sourceType, 'research');
  }
  assert.equal(sanitizeEntry({ ...valid, domain: ['climate'] }), null);
});

test('all catalog URL fields reject malformed HTTP locations', () => {
  for (const url of ['https://?', 'https://#fragment', 'https://example.org:invalid/file', 'https://[bad]/']) {
    assert.equal(sanitizeEntry({ ...valid, url }), null);
    const entry = sanitizeEntry({ ...valid, landingPage: url, licenseUrl: url,
      sample: { columns: ['a', 'b'], rows: [[1, 2]], source: url } });
    assert.equal(entry.landingPage, valid.url);
    assert.equal(entry.licenseUrl, undefined);
    assert.equal(entry.sample.source, undefined);
  }
});

test('country tags are deduplicated strings before applying the four-country limit', () => {
  const entry = sanitizeEntry({ ...valid, countries: [['US'], 'IN', 'IN', 'US', 'BR', 'AU', 'NZ'] });
  assert.deepEqual(entry.countries, ['IN', 'US', 'BR', 'AU']);
});

test('malformed catalog payloads fail with an explicit shape error', () => {
  for (const value of [null, undefined, 1, {}, { datasets: {} }, { datasets: null }]) {
    assert.throws(() => buildCatalog(value), /Catalog must be an array or an object with a datasets array/);
  }
  assert.equal(buildCatalog([valid]).length, 1);
});

test('malformed scalar objects never invoke untrusted coercion methods', () => {
  const malformed = JSON.parse('{"toString":null,"valueOf":null}');
  const [entry] = buildCatalog([{ ...valid, title: malformed, description: malformed, source: malformed,
    license: malformed, formats: [malformed], licenseOpenness: malformed, freshnessYear: malformed,
    coverageStart: malformed, coverageEnd: malformed, approxSizeMB: malformed, kaggleRef: malformed,
    verified: malformed, id: malformed, granularity: malformed,
    resources: [{ url: 'https://example.org/data.csv', label: malformed, format: malformed }],
    sample: { columns: ['a', 'b'], rows: [[malformed, 2]] },
  }]);
  assert.equal(entry.title, 'Untitled dataset');
  assert.equal(entry.description, '');
  assert.equal(entry.source, 'Unknown');
  assert.equal(entry.granularity, 'unknown');
  assert.equal(entry.license, 'Unknown');
  assert.deepEqual(entry.formats, ['Other']);
  assert.equal(entry.licenseOpenness, 0);
  assert.equal(entry.freshnessYear, 2015);
  assert.equal(entry.coverageStart, 2015);
  assert.equal(entry.coverageEnd, 2015);
  assert.equal(entry.approxSizeMB, 1);
  assert.equal(entry.kaggleRef, undefined);
  assert.equal(entry.verified, undefined);
  assert.match(entry.id, /^d[a-z0-9]+$/);
  assert.equal(entry.resources[0].format, 'Other');
  assert.deepEqual(entry.sample.rows, [['', '2']]);
});

test('non-finite numbers and fractional years do not escape catalog normalization', () => {
  const entry = sanitizeEntry({ ...valid, freshnessYear: 'Infinity', coverageStart: 2000.5,
    coverageEnd: 'NaN', approxSizeMB: 'Infinity', licenseOpenness: 'Infinity' });
  assert.equal(entry.freshnessYear, 2015);
  assert.equal(entry.coverageStart, 2015);
  assert.equal(entry.coverageEnd, 2015);
  assert.equal(entry.approxSizeMB, 1);
  assert.equal(entry.licenseOpenness, 0);
});
