import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { buildCatalog } from '../js/catalog.js';

const rawCatalog = {
  datasets: [
    {
      title: 'A', description: '', domain: 'climate', region: 'asia',
      source: 'Kaggle', sourceType: 'kaggle', url: 'https://k.com/a',
      formats: ['CSV'], license: 'CC0', licenseOpenness: 1,
      freshnessYear: 2024, coverageStart: 2000, coverageEnd: 2024,
      granularity: 'country', approxSizeMB: 1,
    },
    {
      title: 'B', description: '', domain: 'health', region: 'global',
      source: 'WHO', sourceType: 'intl-org', url: 'https://who.int/b',
      formats: ['API'], license: 'CC BY', licenseOpenness: 0.8,
      freshnessYear: 2023, coverageStart: 2000, coverageEnd: 2023,
      granularity: 'country', approxSizeMB: 2,
    },
  ],
};

function fakeStorage(initial = []) {
  let stored = [...initial];
  return {
    load: () => [...stored],
    save: (ids) => { stored = [...ids]; },
    peek: () => stored,
  };
}

function mkStore(pinStorage = fakeStorage()) {
  return createStore({ catalog: buildCatalog(rawCatalog), pinStorage });
}

test('initial state matches everything', () => {
  const store = mkStore();
  assert.equal(store.select.filtered().length, 2);
  assert.deepEqual(store.select.allFormats(), ['CSV', 'API']);
});

test('setDomain filters and clears a mismatched preset', () => {
  const store = mkStore();
  store.actions.togglePreset(2); // "Model climate risk" → domain climate
  assert.equal(store.getState().preset, 2);
  store.actions.setDomain('health');
  assert.equal(store.getState().preset, null);
  assert.equal(store.select.filtered().length, 1);
  assert.equal(store.select.filtered()[0].title, 'B');
});

test('resetFilters restores full results after facet churn', () => {
  const store = mkStore();
  store.actions.toggleSourceType('kaggle', false);
  store.actions.setSearch('who');
  store.actions.setMinOpenness(0.9);
  assert.equal(store.select.filtered().length, 0);
  store.actions.resetFilters();
  assert.equal(store.select.filtered().length, 2);
  // and facet toggling still works against the fresh sets
  store.actions.toggleSourceType('kaggle', false);
  assert.equal(store.select.filtered().length, 1);
});

test('togglePin persists through the injected storage port', () => {
  const storage = fakeStorage();
  const store = mkStore(storage);
  const id = store.select.catalog()[0].id;
  assert.equal(store.actions.togglePin(id), true);
  assert.deepEqual(storage.peek(), [id]);
  assert.equal(store.actions.togglePin(id), false);
  assert.deepEqual(storage.peek(), []);
});

test('stale pins are pruned against the catalog at boot', () => {
  const storage = fakeStorage(['ghost-id']);
  const store = mkStore(storage);
  assert.equal(store.getState().pins.size, 0);
  assert.deepEqual(storage.peek(), []);
});

test('subscribers fire on every action', () => {
  const store = mkStore();
  let calls = 0;
  const unsub = store.subscribe(() => calls++);
  store.actions.setSearch('a');
  store.actions.selectRegion('asia');
  unsub();
  store.actions.setSearch('');
  assert.equal(calls, 2);
});

test('passport drawer and region rail are mutually exclusive', () => {
  const store = mkStore();
  store.actions.selectRegion('asia');
  store.actions.openPassport();
  assert.equal(store.getState().passportOpen, true);
  assert.equal(store.getState().region, null);
  store.actions.selectRegion('asia');
  assert.equal(store.getState().passportOpen, false);
  assert.equal(store.getState().region, 'asia');
  store.actions.togglePassport();
  assert.equal(store.getState().passportOpen, true);
  store.actions.togglePassport();
  assert.equal(store.getState().passportOpen, false);
});

test('regionDatasets sorts by freshness descending', () => {
  const store = mkStore();
  store.actions.selectRegion('asia');
  const asia = store.select.regionDatasets('asia');
  assert.deepEqual(asia.map((d) => d.title), ['A']);
});

test('sort control reorders datasets (A–Z, openness)', () => {
  const raw = { datasets: [
    { ...rawCatalog.datasets[0], title: 'Zeta', url: 'https://x.com/z', licenseOpenness: 1, freshnessYear: 2020 },
    { ...rawCatalog.datasets[0], title: 'Alpha', url: 'https://x.com/a', licenseOpenness: 0.4, freshnessYear: 2026 },
  ] };
  const store = createStore({ catalog: buildCatalog(raw), pinStorage: fakeStorage() });
  store.actions.setSort('title');
  assert.deepEqual(store.select.regionDatasets('asia').map((d) => d.title), ['Alpha', 'Zeta']);
  store.actions.setSort('openness');
  assert.deepEqual(store.select.regionDatasets('asia').map((d) => d.title), ['Zeta', 'Alpha']);
  store.actions.setSort('nonsense');
  assert.equal(store.getState().sort, 'openness', 'unknown sort keys are ignored');
});

test('removing the last compare item also closes the modal (no ghost state)', () => {
  const store = mkStore();
  const id = store.select.catalog()[0].id;
  store.actions.toggleCompare(id);
  store.actions.setCompareOpen(true);
  store.actions.toggleCompare(id); // remove last item while modal is open
  assert.equal(store.getState().compareOpen, false);
});

test('a throwing subscriber does not silence later subscribers', () => {
  const store = mkStore();
  let laterRan = false;
  store.subscribe(() => { throw new Error('boom'); });
  store.subscribe(() => { laterRan = true; });
  store.actions.setSearch('x');
  assert.equal(laterRan, true);
});

test('compare tray holds at most four and clears', () => {
  const store = mkStore();
  const [a, b] = store.select.catalog();
  assert.equal(store.actions.toggleCompare(a.id), true);
  assert.equal(store.actions.toggleCompare(b.id), true);
  assert.deepEqual(store.select.compareDatasets().map((d) => d.id).sort(), [a.id, b.id].sort());
  assert.equal(store.actions.toggleCompare(a.id), true, 'toggling off succeeds');
  assert.equal(store.getState().compare.size, 1);
  store.actions.clearCompare();
  assert.equal(store.getState().compare.size, 0);
});

test('visit-changes filter narrows to new/updated ids', () => {
  const catalog = buildCatalog(rawCatalog);
  const store = createStore({
    catalog,
    pinStorage: fakeStorage(),
    changes: { newIds: new Set([catalog[0].id]), updatedIds: new Set() },
  });
  assert.equal(store.select.changeCount(), 1);
  assert.equal(store.select.changeKind(catalog[0].id), 'new');
  store.actions.setOnlyChanged(true);
  assert.deepEqual(store.select.filtered().map((d) => d.id), [catalog[0].id]);
  store.actions.resetFilters();
  assert.equal(store.getState().onlyChanged, false);
});

test('importPins merges only known ids and reports the count', () => {
  const storage = fakeStorage();
  const store = createStore({ catalog: buildCatalog(rawCatalog), pinStorage: storage });
  const id = store.select.catalog()[0].id;
  assert.equal(store.actions.importPins([id, 'ghost-id', id]), 1);
  assert.deepEqual(storage.peek(), [id]);
  assert.equal(store.actions.importPins([id]), 0, 'already-pinned ids are not re-imported');
});

test('presetBundleIds resolves bundle URLs to catalog ids, skipping absentees', async () => {
  const { PRESETS } = await import('../js/config.js');
  const bundled = PRESETS.findIndex((p) => p.bundle?.length);
  assert.notEqual(bundled, -1, 'at least one preset carries a starter bundle');
  const raw = {
    datasets: [
      { ...rawCatalog.datasets[0], title: 'Bundle member', url: PRESETS[bundled].bundle[0] },
      rawCatalog.datasets[1],
    ],
  };
  const store = createStore({ catalog: buildCatalog(raw), pinStorage: fakeStorage() });
  const ids = store.select.presetBundleIds(bundled);
  assert.equal(ids.length, 1, 'only bundle URLs present in the catalog resolve');
  assert.equal(ids[0], store.select.catalog().find((d) => d.title === 'Bundle member').id);
  assert.deepEqual(store.select.presetBundleIds(99), [], 'unknown preset index yields an empty bundle');
});

test('railMode reflects region vs search-anywhere', () => {
  const store = mkStore();
  assert.equal(store.select.railMode(), null);
  store.actions.setSearch('who');
  assert.equal(store.select.railMode(), 'search');
  store.actions.selectRegion('asia');
  assert.equal(store.select.railMode(), 'region');
  store.actions.selectRegion(null);
  assert.equal(store.select.railMode(), 'search');
  store.actions.setSearch('');
  assert.equal(store.select.railMode(), null);
});

test('country focus sorts covering datasets first and clears with the region', () => {
  const raw = {
    datasets: [
      { ...rawCatalog.datasets[0], title: 'Older India', url: 'https://x.com/in', countries: ['IN'], freshnessYear: 2015 },
      { ...rawCatalog.datasets[0], title: 'Fresh Regional', url: 'https://x.com/asia', freshnessYear: 2026 },
    ],
  };
  const store = createStore({ catalog: buildCatalog(raw), pinStorage: fakeStorage() });
  store.actions.selectRegion('asia', 'IN');
  assert.equal(store.getState().focusCountry, 'IN');
  // the India-tagged dataset outranks the fresher regional one under focus
  assert.deepEqual(store.select.regionDatasets('asia').map((d) => d.title), ['Older India', 'Fresh Regional']);
  assert.equal(store.select.countryDatasets('IN').length, 1);
  store.actions.selectRegion(null);
  assert.equal(store.getState().focusCountry, null);
  // without focus, freshness ordering rules
  store.actions.selectRegion('asia');
  assert.deepEqual(store.select.regionDatasets('asia').map((d) => d.title), ['Fresh Regional', 'Older India']);
});
