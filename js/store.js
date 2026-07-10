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

/**
 * @param {object} deps
 * @param {object[]} deps.catalog sanitized catalog entries (with ids)
 * @param {{load: () => string[], save: (ids: string[]) => void}} deps.pinStorage
 * @param {string} [deps.initialTheme] 'light' | 'dark'
 */
export function createStore({ catalog, pinStorage, initialTheme = DEFAULT_THEME }) {
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
  };

  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());

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
      return filterCatalog(catalog, state)
        .filter((d) => d.region === region)
        .sort((a, b) => covers(b) - covers(a) || (b.freshnessYear || 0) - (a.freshnessYear || 0));
    },
    /** Filtered datasets tagged as covering a specific country (cca2). */
    countryDatasets: (cca2) =>
      filterCatalog(catalog, state).filter((d) => (d.countries || []).includes(cca2)),
    pinnedDatasets: () => catalog.filter((d) => state.pins.has(d.id)),
    isPinned: (id) => state.pins.has(id),
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
    resetFilters() {
      state.domain = 'all';
      state.sourceTypes = new Set(Object.keys(SOURCE_TYPE_META));
      state.formats = new Set(allFormats);
      state.minOpenness = 0;
      state.search = '';
      state.preset = null;
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
