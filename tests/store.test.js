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
