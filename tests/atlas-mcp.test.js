import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  searchCatalog, getDataset, getResource, listBundles, listKits, assessFitTool, buildPassport, toolDefinitions, loadCatalog, dispatch,
  recommendKitTool, checkIdentifiersTool, assessJoinTool, getCrosswalkTool,
} from '../scripts/atlas-mcp.js';
import { buildCatalog } from '../js/catalog.js';
import { PRESETS } from '../js/config.js';

const raw = {
  datasets: [
    {
      title: 'India Crop Production', description: 'district-wise crop production statistics',
      domain: 'agriculture', region: 'asia', source: 'data.gov.in', sourceType: 'gov-portal',
      url: 'https://example.org/india-crops', formats: ['CSV', 'API'], license: 'GODL',
      licenseOpenness: 0.7, freshnessYear: 2024, coverageStart: 1997, coverageEnd: 2024,
      granularity: 'admin', approxSizeMB: 40, countries: ['IN'],
    },
    {
      title: 'Global Crop Yields', description: 'long-run yields per country',
      domain: 'agriculture', region: 'global', source: 'OWID', sourceType: 'research',
      url: 'https://example.org/owid-yields', formats: ['CSV'], license: 'CC BY 4.0',
      licenseOpenness: 0.9, freshnessYear: 2025, coverageStart: 1961, coverageEnd: 2023,
      granularity: 'country', approxSizeMB: 5,
    },
    {
      title: 'Kaggle Crops', description: 'a kaggle crop dataset',
      domain: 'agriculture', region: 'asia', source: 'Kaggle', sourceType: 'kaggle',
      url: 'https://www.kaggle.com/datasets/owner/crops', kaggleRef: 'owner/crops',
      formats: ['CSV'], license: 'CC0', licenseOpenness: 1, freshnessYear: 2023,
      coverageStart: 2000, coverageEnd: 2023, granularity: 'point', approxSizeMB: 900,
    },
    {
      title: 'EU Hospital Beds', description: 'health infrastructure counts',
      domain: 'health', region: 'europe', source: 'Eurostat', sourceType: 'intl-org',
      url: 'https://example.org/eu-beds', formats: ['API'], license: 'CC BY 4.0',
      licenseOpenness: 0.8, freshnessYear: 2025, coverageStart: 2000, coverageEnd: 2025,
      granularity: 'country', approxSizeMB: 2,
    },
  ],
};
const catalog = buildCatalog(raw);

test('search_catalog filters by domain and includes global entries with a region', () => {
  const r = searchCatalog(catalog, { domain: 'agriculture', region: 'asia' });
  assert.equal(r.total, 3, 'two asia entries + one global');
  assert.ok(r.results.every((d) => d.domain === 'agriculture'));
  const withoutGlobal = searchCatalog(catalog, { domain: 'agriculture', region: 'asia', includeGlobal: false });
  assert.equal(withoutGlobal.total, 2);
});

test('search_catalog boosts country-tagged entries and reports countryMatch', () => {
  const r = searchCatalog(catalog, { domain: 'agriculture', country: 'in' });
  assert.equal(r.results[0].title, 'India Crop Production', 'lowercase iso code still boosts');
  assert.equal(r.results[0].countryMatch, true);
  assert.equal(r.results[1].countryMatch, false);
});

test('search_catalog applies openness, size, and query facets', () => {
  assert.equal(searchCatalog(catalog, { minOpenness: 0.85 }).total, 2);
  assert.equal(searchCatalog(catalog, { maxSizeMB: 10 }).total, 2);
  assert.equal(searchCatalog(catalog, { query: 'district' }).total, 1);
  assert.equal(searchCatalog(catalog, { query: 'DISTRICT' }).total, 1, 'query is case-insensitive');
});

test('search_catalog query is scoped to title/description/source, not domain/region slugs', () => {
  // "asia" is a region slug on two entries but appears in no human text
  assert.equal(searchCatalog(catalog, { query: 'asia' }).total, 0, 'region slug is not a keyword match');
  assert.equal(searchCatalog(catalog, { query: 'agriculture' }).total, 0, 'domain key is not a keyword match');
  assert.equal(searchCatalog(catalog, { query: 'yields' }).total, 1, 'real title/description word still matches');
});

test('search_catalog preserves the Geo format label and validates array facets loudly', () => {
  // 'Geo' must not be re-normalized to 'Other'
  const geo = buildCatalog({ datasets: [{
    ...raw.datasets[0], title: 'Shapes', url: 'https://example.org/shapes', formats: ['Shapefile'],
  }] });
  assert.equal(searchCatalog(geo, { formats: ['Geo'] }).total, 1, 'Geo label reaches shapefile datasets');
  assert.equal(searchCatalog(geo, { formats: ['CSV'] }).total, 0);
  assert.throws(() => searchCatalog(catalog, { formats: ['GeoJSON'] }), /unknown formats value/);
  assert.throws(() => searchCatalog(catalog, { sourceTypes: ['govportal'] }), /unknown sourceTypes value/);
  assert.throws(() => searchCatalog(catalog, { sourceTypes: 'kaggle' }), /must be an array/);
});

test('search_catalog floors a fractional limit so returned matches results length', () => {
  const r = searchCatalog(catalog, { limit: 2.9 });
  assert.equal(r.returned, 2);
  assert.equal(r.results.length, 2);
  assert.ok(Number.isInteger(r.returned));
});

test('search_catalog rejects unknown facet values loudly', () => {
  assert.throws(() => searchCatalog(catalog, { domain: 'astrology' }), /unknown domain/);
  assert.throws(() => searchCatalog(catalog, { region: 'atlantis' }), /unknown region/);
  assert.throws(() => searchCatalog(catalog, { sort: 'vibes' }), /unknown sort/);
});

test('search_catalog sorts deterministically and clamps limit', () => {
  const byFresh = searchCatalog(catalog, { sort: 'freshness', limit: 2 });
  assert.equal(byFresh.returned, 2);
  assert.equal(byFresh.results[0].freshnessYear, 2025);
  const byCoverage = searchCatalog(catalog, { sort: 'coverage' });
  assert.equal(byCoverage.results[0].title, 'Global Crop Yields', '62-year span wins');
  assert.equal(searchCatalog(catalog, { limit: 9999 }).returned, catalog.length <= 50 ? catalog.length : 50);
});

test('get_dataset returns DNA detail and a kaggle download command', () => {
  const kaggle = catalog.find((d) => d.kaggleRef);
  const r = getDataset(catalog, { id: kaggle.id });
  assert.equal(r.download, 'kaggle datasets download -d owner/crops');
  assert.equal(r.dnaDetail.length, 5);
  assert.ok(r.share_url.endsWith(`#p=${kaggle.id}`));
  assert.throws(() => getDataset(catalog, { id: 'dnope' }), /no dataset/);
});

test('list_bundles resolves preset bundle URLs against the real catalog', async () => {
  const real = await loadCatalog();
  const r = listBundles(real);
  assert.equal(r.bundles.length, PRESETS.length);
  for (const b of r.bundles) {
    assert.equal(b.datasets.length, 5, `bundle "${b.label}" resolves all 5 datasets`);
    for (const d of b.datasets) assert.match(d.id, /^d[a-z0-9]+$/);
  }
});

test('build_passport produces manifest, bibliography, and a parseable share link', () => {
  const ids = catalog.map((d) => d.id);
  const r = buildPassport(catalog, { ids: [...ids, 'ghost', 'ghost', ids[0]] }, '2026-07-11');
  assert.equal(r.count, catalog.length, 'duplicates collapse, ghosts are reported');
  assert.deepEqual(r.unknown_ids, ['ghost'], 'duplicate unknown ids are deduped');
  assert.ok(r.manifest_sh.startsWith('#!/usr/bin/env bash'));
  assert.ok(r.manifest_sh.includes('kaggle datasets download -d owner/crops'));
  assert.ok(r.references_bib.includes('accessed 2026-07-11'));
  const hash = r.share_url.split('#')[1];
  const pins = new URLSearchParams(hash).get('p').split('.');
  assert.deepEqual(pins, ids, 'share link round-trips every pinned id');
  assert.throws(() => buildPassport(catalog, { ids: [] }), /required/);
  assert.throws(() => buildPassport(catalog, { ids: ['ghost'] }), /none of the ids/);
});

test('manifest strings stay hardened through the passport path', () => {
  const sneaky = buildCatalog({
    datasets: [{
      title: 'Evil\ntitle # rm -rf', description: 'x', domain: 'health', region: 'europe',
      source: 'S', sourceType: 'ngo', url: 'https://example.org/ok', formats: ['CSV'],
      license: 'MIT', licenseOpenness: 0.5, freshnessYear: 2024, coverageStart: 2020,
      coverageEnd: 2024, granularity: 'country', approxSizeMB: 1,
    }],
  });
  const r = buildPassport(sneaky, { ids: [sneaky[0].id] });
  for (const line of r.manifest_sh.split('\n')) {
    assert.ok(!line || line.startsWith('#'), `non-comment line leaked: ${JSON.stringify(line)}`);
  }
});

test('tool definitions carry the vocabulary agents need', () => {
  const defs = toolDefinitions();
  assert.deepEqual(defs.map((t) => t.name),
    ['search_catalog', 'get_dataset', 'get_resource', 'list_bundles', 'list_kits', 'recommend_kit', 'assess_fit', 'assess_join', 'check_identifiers', 'get_crosswalk', 'build_passport']);
  const search = defs[0].inputSchema.properties;
  assert.ok(search.domain.enum.includes('agriculture'));
  assert.ok(search.region.enum.includes('global'));
  assert.equal(defs.find((t) => t.name === 'build_passport').inputSchema.required[0], 'ids');
});

test('compact() truncates a long description on a code-point boundary', () => {
  const long = buildCatalog({ datasets: [{
    ...raw.datasets[0], title: 'Emoji', url: 'https://example.org/emoji',
    description: `${'a'.repeat(216)}😀 tail that runs well past the limit`,
  }] });
  const desc = searchCatalog(long, {}).results[0].description;
  assert.ok(desc.endsWith('...'));
  // no lone surrogate survives: re-encoding round-trips cleanly
  assert.ok(![...desc].some((ch) => { const c = ch.codePointAt(0); return c >= 0xd800 && c <= 0xdfff; }),
    'no unpaired surrogate in the truncated description');
});

test('dispatch routes requests and notifications by JSON-RPC semantics', async () => {
  const cat = await loadCatalog();
  const init = await dispatch(cat, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(init.result.serverInfo.name, 'dataset-atlas');
  assert.ok('tools' in init.result.capabilities);

  const list = await dispatch(cat, { jsonrpc: '2.0', id: 'a', method: 'tools/list' });
  assert.equal(list.result.tools.length, 11, 'string ids are echoed');

  const call = await dispatch(cat, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_bundles', arguments: {} } });
  const payload = JSON.parse(call.result.content[0].text);
  assert.ok(Array.isArray(payload.bundles));

  const toolErr = await dispatch(cat, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_catalog', arguments: { domain: 'astrology' } } });
  assert.equal(toolErr.result.isError, true, 'tool failure is a content error, not a protocol error');

  const notFound = await dispatch(cat, { jsonrpc: '2.0', id: 4, method: 'no/such' });
  assert.equal(notFound.error.code, -32601);
});

test('dispatch never replies to a notification, even for a known method', async () => {
  const cat = await loadCatalog();
  assert.equal(await dispatch(cat, { jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(await dispatch(cat, { jsonrpc: '2.0', method: 'tools/list' }), null,
    'a known method with no id is a notification and gets no reply');
});

test('list_kits resolves verified pairs and assess_fit screens the energy kit', async () => {
  const real = await loadCatalog();
  const kits = listKits(real);
  assert.equal(kits.kits.length, 5);
  const energy = kits.kits.find((k) => k.id === 'energy-co2');
  assert.equal(energy.status, 'verified');
  assert.equal(energy.datasets.length, 2);
  const crop = kits.kits.find((k) => k.id === 'india-crop-rainfall');
  assert.ok(crop.crosswalk.endsWith('india-district-subdivision.json'));
  const covid = kits.kits.find((k) => k.id === 'covid-population');
  assert.equal(covid.status, 'verified');
  const air = kits.kits.find((k) => k.id === 'openaq-national-pm25');
  assert.equal(air.outcome, 'do-not-join');
  const fit = assessFitTool(real, { task: 'energy', country: 'IN' });
  assert.equal(fit.pair.join.status, 'match');
  const resource = getResource(real, { id: energy.datasets[0].id });
  assert.equal(resource.access.primary.kind, 'download');
});

test('MCP recommend_kit, identifiers, crosswalk, and assess_join refuse unsafe joins', async () => {
  const real = await loadCatalog();
  const rec = recommendKitTool({ query: 'join India crop production to rainfall' });
  assert.equal(rec.kits[0].id, 'india-crop-rainfall');
  const none = recommendKitTool({ query: 'spotify playlists' });
  assert.equal(none.kits.length, 0);
  assert.match(none.guidance, /Do not invent a join/);

  const ids = checkIdentifiersTool({ codes: ['IN', 'WLD', 'OWID_WRL', 'World', 'SAS'] });
  assert.deepEqual(ids.keep, ['IND']);
  assert.ok(ids.drop.includes('WLD') && ids.drop.includes('OWID_WRL'));

  const imd = getCrosswalkTool({ kit: 'india-crop-rainfall', state: 'Maharashtra', district: 'Pune' });
  assert.equal(imd.subdivision, 'Madhya Maharashtra');
  const pcode = getCrosswalkTool({ kit: 'nga-pcode-population', pcode: 'NG025' });
  assert.equal(pcode.admin.name, 'Lagos');

  const energy = listKits(real).kits.find((k) => k.id === 'energy-co2');
  const joined = assessJoinTool(real, { idA: energy.datasets[0].id, idB: energy.datasets[1].id });
  assert.equal(joined.status, 'match');
  const air = listKits(real).kits.find((k) => k.id === 'openaq-national-pm25');
  const refused = assessJoinTool(real, { idA: air.datasets[0].id, idB: air.datasets[1].id });
  assert.equal(refused.status, 'conflict');
  assert.equal(refused.doNotJoin, true);
});

test('dispatch answers a request whose method happens to start with notifications/', async () => {
  const cat = await loadCatalog();
  const r = await dispatch(cat, { jsonrpc: '2.0', id: 9, method: 'notifications/whatever' });
  assert.equal(r.error.code, -32601, 'an id present means a reply is owed (no client hang)');
});
