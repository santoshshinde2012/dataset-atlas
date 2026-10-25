import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAtlasData } from '../js/services/atlas-data.js';

function source(overrides = {}) {
  const payloads = {
    'world-110m': {}, 'country-regions': {}, 'country-codes': {},
    catalog: { datasets: [], generated: '2026-10-25' }, pilot: { profiles: [] }, 'country-coverage': { series: {} },
  };
  return async (url) => {
    assert.match(url, /^\/atlas\/data\//);
    const path = url.split('/').at(-1).replace('.json', '');
    if (overrides[path]) return overrides[path];
    return { ok: true, json: async () => payloads[path] };
  };
}

test('asset loader supports a replaceable fetch port and repository subpaths', async () => {
  const data = await loadAtlasData('/atlas/', source());
  assert.deepEqual(data.catalog, []);
  assert.equal(data.generated, '2026-10-25');
});

test('optional coverage failure preserves boot without inventing observations', async () => {
  const data = await loadAtlasData('/atlas/', source({ 'country-coverage': { ok: false, status: 404 } }));
  assert.deepEqual(data.coverage, { series: {} });
});

test('required HTTP errors fail before accepting their JSON payload', async () => {
  await assert.rejects(loadAtlasData('/atlas/', source({ catalog: { ok: false, status: 503, json: async () => ({ datasets: [] }) } })), /catalog: HTTP 503/);
});
