/**
 * Application store: single source of truth + pub/sub.
 *
 * UI components depend only on this narrow interface (getState / select /
 * actions / subscribe), never on each other. Persistence is injected as a
 * plain {load, save} pins-storage port, so the store stays pure enough to
 * unit-test with a fake (dependency inversion).
 */
import { SOURCE_TYPE_META, PRESETS, FORMAT_ORDER, THEMES, DEFAULT_THEME } from './config.js';
import { filterCatalog, regionCounts, domainCounts, matchesFacets } from './filters.js';
import { normFormat } from './utils/text.js';

/** Sort comparators for dataset lists (country-focus always wins first). */
const SORTERS = {
  freshness: (a, b) => (b.freshnessYear || 0) - (a.freshnessYear || 0),
  coverage: (a, b) => ((b.coverageEnd || 0) - (b.coverageStart || 0)) - ((a.coverageEnd || 0) - (a.coverageStart || 0)),
  openness: (a, b) => (b.licenseOpenness || 0) - (a.licenseOpenness || 0),
  size: (a, b) => (a.approxSizeMB || 0) - (b.approxSizeMB || 0),
  title: (a, b) => a.title.localeCompare(b.title),
};

/**
 * @param {object} deps
 * @param {object[]} deps.catalog sanitized catalog entries (with ids)
 * @param {{load: () => string[], save: (ids: string[]) => void}} deps.pinStorage
 * @param {string} [deps.initialTheme] 'light' | 'dark'
 * @param {{newIds?: Set<string>, updatedIds?: Set<string>}} [deps.changes]
 *        catalog diff vs the user's last visit (computed in main.js)
 */
export function createStore({ catalog, pinStorage, initialTheme = DEFAULT_THEME, changes = {} }) {
  const allFormats = [...new Set(catalog.flatMap((d) => (d.formats || []).map(normFormat)))]
    .sort((a, b) => FORMAT_ORDER.indexOf(a) - FORMAT_ORDER.indexOf(b));

  const catalogIds = new Set(catalog.map((d) => d.id));
  const storedPins = pinStorage.load().filter((id) => catalogIds.has(id));
  pinStorage.save(storedPins); // prune ids that no longer resolve to an entry

  const state = {
    domain: 'all',
    sourceTypes: new Set(Object.keys(SOURCE_TYPE_META)),
    formats: new Set(allFormats),
    minOpenness: 0,
    search: '',
    region: null,
    focusCountry: null, // cca2 of the clicked country, when region was entered via a country
    preset: null,
    projection: 'globe',
    passportOpen: false,
    theme: THEMES[initialTheme] ? initialTheme : DEFAULT_THEME,
    pins: new Set(storedPins),
    sort: 'freshness',
    compare: new Set(),            // dataset ids in the compare tray (session-only)
    compareOpen: false,
    onlyChanged: false,            // filter to new/updated since last visit
    changes: {
      newIds: changes.newIds || new Set(),
      updatedIds: changes.updatedIds || new Set(),
    },
  };

  const listeners = new Set();
  // isolate subscribers: one throwing listener must not silence the rest
  const notify = () => listeners.forEach((fn) => {
    try { fn(); } catch (err) { console.error(err); }
  });

  const select = {
    catalog: () => catalog,
    allFormats: () => allFormats,
    filtered: (ignore = []) => filterCatalog(catalog, state, ignore),
    regionCounts: () => regionCounts(filterCatalog(catalog, state)),
    domainCounts: (ignore = ['domain']) => domainCounts(filterCatalog(catalog, state, ignore)),
    matches: (d, ignore = []) => matchesFacets(d, state, ignore),
    regionDatasets: (region) => {
      const focus = state.focusCountry;
      const covers = (d) => (focus && (d.countries || []).includes(focus) ? 1 : 0);
      const by = SORTERS[state.sort] || SORTERS.freshness;
      return filterCatalog(catalog, state)
        .filter((d) => d.region === region)
        .sort((a, b) => covers(b) - covers(a) || by(a, b));
    },
    /** All filtered datasets grouped for the search-anywhere rail. */
    searchResults: () => {
      const by = SORTERS[state.sort] || SORTERS.freshness;
      return filterCatalog(catalog, state).sort(by);
    },
    compareDatasets: () => catalog.filter((d) => state.compare.has(d.id)),
    changeCount: () => state.changes.newIds.size + state.changes.updatedIds.size,
    changeKind: (id) =>
      state.changes.newIds.has(id) ? 'new'
        : state.changes.updatedIds.has(id) ? 'updated' : null,
    /** Filtered datasets tagged as covering a specific country (cca2). */
    countryDatasets: (cca2) =>
      filterCatalog(catalog, state).filter((d) => (d.countries || []).includes(cca2)),
    pinnedDatasets: () => catalog.filter((d) => state.pins.has(d.id)),
    isPinned: (id) => state.pins.has(id),
    /** Which right-rail view applies: 'region' | 'search' | null. */
    railMode: () => (state.region ? 'region' : state.search ? 'search' : null),
    /** Resolve a preset's starter-bundle URLs to catalog ids (unknown URLs drop). */
    presetBundleIds: (index) => {
      const urls = PRESETS[index]?.bundle || [];
      return urls
        .map((url) => catalog.find((d) => d.url === url)?.id)
        .filter(Boolean);
    },
  };

  const actions = {
    setDomain(key) {
      state.domain = key;
      if (state.preset !== null && PRESETS[state.preset].domain !== key) state.preset = null;
      notify();
    },
    togglePreset(index) {
      if (state.preset === index) {
        state.preset = null;
        state.domain = 'all';
      } else {
        state.preset = index;
        state.domain = PRESETS[index].domain;
      }
      notify();
    },
    toggleSourceType(key, on) {
      on ? state.sourceTypes.add(key) : state.sourceTypes.delete(key);
      notify();
    },
    toggleFormat(key, on) {
      on ? state.formats.add(key) : state.formats.delete(key);
      notify();
    },
    setMinOpenness(v) { state.minOpenness = +v; notify(); },
    setSearch(q) { state.search = q.trim().toLowerCase(); notify(); },
    selectRegion(key, focusCountry = null) {
      state.region = key;
      state.focusCountry = key ? focusCountry : null;
      // the card rail and the passport drawer share the right edge
      if (key) state.passportOpen = false;
      notify();
    },
    setProjection(mode) { state.projection = mode; notify(); },
    setTheme(theme) {
      if (THEMES[theme]) { state.theme = theme; notify(); }
    },
    toggleTheme() {
      actions.setTheme(state.theme === 'light' ? 'dark' : 'light');
    },
    openPassport() { state.passportOpen = true; state.region = null; notify(); },
    closePassport() { state.passportOpen = false; notify(); },
    togglePassport() {
      state.passportOpen ? actions.closePassport() : actions.openPassport();
    },
    /** @returns {boolean} whether the dataset is pinned after the toggle */
    togglePin(id) {
      const pinned = !state.pins.has(id);
      pinned ? state.pins.add(id) : state.pins.delete(id);
      pinStorage.save([...state.pins]);
      notify();
      return pinned;
    },
    clearPins() {
      state.pins.clear();
      pinStorage.save([]);
      notify();
    },
    /** Merge pin ids from a shared URL; returns how many were added. */
    importPins(ids) {
      const valid = [...new Set(ids)].filter((id) => catalogIds.has(id) && !state.pins.has(id));
      for (const id of valid) state.pins.add(id);
      if (valid.length) {
        pinStorage.save([...state.pins]);
        notify();
      }
      return valid.length;
    },
    setSort(key) {
      if (SORTERS[key]) { state.sort = key; notify(); }
    },
    toggleCompare(id) {
      if (state.compare.has(id)) {
        state.compare.delete(id);
        if (state.compare.size === 0) state.compareOpen = false; // no ghost open state
      } else if (state.compare.size < 4) state.compare.add(id);
      else return false; // tray full
      notify();
      return true;
    },
    setCompareOpen(open) { state.compareOpen = !!open; notify(); },
    clearCompare() { state.compare.clear(); state.compareOpen = false; notify(); },
    setOnlyChanged(on) { state.onlyChanged = !!on; notify(); },
    enableAllSources() {
      Object.keys(SOURCE_TYPE_META).forEach((k) => state.sourceTypes.add(k));
      notify();
    },
    enableAllFormats() {
      allFormats.forEach((f) => state.formats.add(f));
      notify();
    },
    resetFilters() {
      state.domain = 'all';
      state.sourceTypes = new Set(Object.keys(SOURCE_TYPE_META));
      state.formats = new Set(allFormats);
      state.minOpenness = 0;
      state.search = '';
      state.preset = null;
      state.onlyChanged = false;
      notify();
    },
  };

  return {
    getState: () => state,
    select,
    actions,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
