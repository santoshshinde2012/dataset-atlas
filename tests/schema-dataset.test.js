import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datasetJsonLd, datasetPageHtml } from '../scripts/schema-dataset.js';
import { sanitizeEntry } from '../js/catalog.js';

const entry = {
  id: 'dexample', title: 'Example', description: 'A dataset',
  source: 'Provider', url: 'https://example.test/data',
  domain: 'climate', region: 'global', coverageStart: 2000, coverageEnd: 2024,
  license: 'Unknown', licenseOpenness: 1,
};
const render = (d) => datasetPageHtml(d, {
  pageUrl: 'https://atlas.test/dataset/dexample.html',
  appUrl: 'https://atlas.test/index.html',
  jsonLd: datasetJsonLd(d, 'https://atlas.test/dataset/dexample.html'),
});

test('dataset markup does not infer access cost or fabricate a license URL', () => {
  const graph = datasetJsonLd(sanitizeEntry(entry), 'https://atlas.test/');
  assert.equal(graph.isAccessibleForFree, undefined);
  assert.equal(graph.license, undefined);
  const d = sanitizeEntry({ ...entry, license: 'CC BY 4.0', isAccessibleForFree: false });
  assert.equal(datasetJsonLd(d).license, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(datasetJsonLd(d).isAccessibleForFree, false);
  assert.match(render(d), /Access cost: Paid/);
});

test('all downloads are visible and indexed; API and page URLs are not download files', () => {
  const d = sanitizeEntry({ ...entry, resources: [
    { kind: 'download', format: 'CSV', url: 'https://example.test/data.csv' },
    { kind: 'download', format: 'JSON', url: 'https://example.test/data.json' },
    { kind: 'api', format: 'JSON', url: 'https://example.test/api' },
    { kind: 'page', url: 'https://example.test/help' },
  ] });
  const graph = datasetJsonLd(d);
  assert.deepEqual(graph.distribution.map((r) => r.contentUrl), d.resources.slice(0, 2).map((r) => r.url));
  for (const r of d.resources.slice(0, 3)) assert.ok(render(d).includes(`href="${r.url}"`));
  assert.equal(datasetJsonLd({ ...d, resources: d.resources.slice(2) }).distribution, undefined);
});

test('dataset text cannot close the JSON-LD script and execute HTML', () => {
  const d = sanitizeEntry({ ...entry, title: '</script><script>alert(1)</script>', description: '<!-- <script> & quoted " text' });
  const html = render(d);
  assert.equal([...html.matchAll(/<script\b/g)].length, 1);
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(json).name, d.title);
  assert.equal(JSON.parse(json).description, d.description);
  assert.doesNotMatch(json, /</);
  assert.match(html, /&lt;\/script&gt;/);
});

test('meta descriptions truncate text before HTML entity escaping', () => {
  const html = render(sanitizeEntry({ ...entry, description: 'a'.repeat(239) + '&tail' }));
  assert.match(html, new RegExp(`content="${'a'.repeat(239)}&amp;"`));
});
