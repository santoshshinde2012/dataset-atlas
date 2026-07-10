/**
 * Composition root. The only module that knows about every piece: it loads
 * the data, builds the store and services, and injects them into the map
 * and UI components. Components never import each other.
 */
import { loadAtlasData } from './catalog.js';
import { createStore } from './store.js';
import { THEMES, DEFAULT_THEME } from './config.js';
import { localPinStorage } from './services/storage.js';
import { createToast } from './services/toast.js';
import { createClipboard } from './services/clipboard.js';
import { createTooltip } from './ui/tooltip.js';
import { MapView } from './map/map-view.js';
import { initTopbar } from './ui/topbar.js';
import { initDomainDock } from './ui/domain-dock.js';
import { initFilterRail, setCollapsed } from './ui/filter-rail.js';
import { initCardRail } from './ui/card-rail.js';
import { initPassport } from './ui/passport.js';
import { initWelcome } from './ui/welcome.js';
import { initCompare } from './ui/compare.js';
import { serializeState, parseState } from './url-state.js';
import { REGION_META, DOMAIN_META, GLOBAL_REGION } from './config.js';
import { $ } from './utils/dom.js';
import { esc } from './utils/text.js';
import { icon } from './icons.js';

/**
 * Diff the catalog against what this browser saw last visit
 * ({id: freshnessYear} in localStorage) → new / freshness-updated sets.
 */
function computeVisitChanges(catalog) {
  const KEY = 'atlas-known';
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* corrupt */ }
  const current = Object.fromEntries(catalog.map((d) => [d.id, d.freshnessYear]));
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* session-only */ }
  if (!prev || typeof prev !== 'object') {
    return { newIds: new Set(), updatedIds: new Set() }; // first visit: nothing to diff
  }
  const newIds = new Set();
  const updatedIds = new Set();
  for (const d of catalog) {
    if (!(d.id in prev)) newIds.add(d.id);
    else if (d.freshnessYear > prev[d.id]) updatedIds.add(d.id);
  }
  return { newIds, updatedIds };
}

/** Hydrate static [data-icon] placeholders in index.html with inline SVGs. */
function hydrateIcons() {
  document.querySelectorAll('[data-icon]').forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });
}

async function boot() {
  hydrateIcons(); // static chrome icons appear while data loads
  const { world, countryRegion, countryCodes, catalog, generated } = await loadAtlasData();
  const countryNames = Object.fromEntries(
    Object.values(countryCodes).map((c) => [c.cca2, c.name])
  );
  window.__atlasBooted = true; // disarms the boot-fallback watchdog in index.html
  // on slow connections the watchdog may already have fired before boot
  // finished — a successful boot must clear the overlay again
  document.getElementById('boot-fallback').hidden = true;

  let storedTheme = null;
  try { storedTheme = localStorage.getItem('atlas-theme'); } catch { /* session-only */ }
  const store = createStore({
    catalog,
    pinStorage: localPinStorage,
    initialTheme: THEMES[storedTheme] ? storedTheme : DEFAULT_THEME,
    changes: computeVisitChanges(catalog),
  });

  // ---- shareable URL state: restore before first render ----
  const fromUrl = parseState(location.hash);
  if (fromUrl.projection) store.actions.setProjection(fromUrl.projection);
  if (fromUrl.domain) store.actions.setDomain(fromUrl.domain);
  if (fromUrl.sort) store.actions.setSort(fromUrl.sort);
  if (fromUrl.minOpenness) store.actions.setMinOpenness(fromUrl.minOpenness);
  if (fromUrl.sourceTypes) {
    const wanted = new Set(fromUrl.sourceTypes);
    for (const k of [...store.getState().sourceTypes]) {
      if (!wanted.has(k)) store.actions.toggleSourceType(k, false);
    }
  }
  if (fromUrl.formats) {
    const wanted = new Set(fromUrl.formats);
    for (const f of [...store.getState().formats]) {
      if (!wanted.has(f)) store.actions.toggleFormat(f, false);
    }
  }
  if (fromUrl.search) store.actions.setSearch(fromUrl.search);
  if (fromUrl.region) store.actions.selectRegion(fromUrl.region, fromUrl.focusCountry || null);

  // theme is applied at the document root; every themed CSS token follows
  const applyTheme = () => {
    const theme = store.getState().theme;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[theme].metaThemeColor);
    try { localStorage.setItem('atlas-theme', theme); } catch { /* session-only */ }
  };
  store.subscribe(applyTheme);
  applyTheme();
  const toast = createToast($('#toast'));
  const copyText = createClipboard(toast);
  const tooltip = createTooltip($('#tooltip'), store, countryCodes);

  new MapView({ svgElement: $('#map'), world, countryRegion, countryCodes, store, tooltip });

  initPassport({ store, toast, copyText });
  initTopbar({ store, onPassportToggle: store.actions.togglePassport });
  initDomainDock({ store });
  initFilterRail({ store, generated });
  initCardRail({ store, toast, copyText, countryNames });
  initCompare({ store, toast });
  initWelcome({ store });

  // pins arriving via a shared link are merged once, with feedback
  if (fromUrl.pins && fromUrl.pins.length) {
    const added = store.actions.importPins(fromUrl.pins);
    if (added) toast(`Imported ${added} pinned dataset${added === 1 ? '' : 's'} from the shared link`);
    history.replaceState(null, '', location.pathname + location.search); // don't re-import on refresh
  }

  // ---- keep the URL shareable: state changes update the hash, deduped and
  // debounced so keystrokes/slider drags can't trip Safari's and Firefox's
  // history rate limits, and guarded so a throttled write never breaks notify
  let urlTimer;
  const writeUrl = () => {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const hash = serializeState(store.getState(), store.select.allFormats());
      const target = location.pathname + location.search + (hash ? '#' + hash : '');
      if (target === location.pathname + location.search + location.hash) return;
      try { history.replaceState(null, '', target); } catch { /* rate-limited */ }
    }, 200);
  };
  store.subscribe(writeUrl);
  writeUrl();

  // pasting/clicking a different share link into the open tab: rebuild cleanly
  // (replaceState never fires hashchange, so this only reacts to external edits)
  addEventListener('hashchange', () => location.reload());

  // ---- screen-reader status announcements (debounced) ----
  let srTimer;
  let lastAnnounce = '';
  store.subscribe(() => {
    clearTimeout(srTimer);
    srTimer = setTimeout(() => {
      const s = store.getState();
      const n = store.select.filtered().length;
      const parts = [`${n} dataset${n === 1 ? '' : 's'}`];
      if (s.domain !== 'all') parts.push(DOMAIN_META[s.domain].name);
      if (s.region) parts.push(s.region === GLOBAL_REGION ? 'Global' : REGION_META[s.region].name);
      if (s.search) parts.push(`search “${s.search}”`);
      const msg = parts.join(' · ');
      if (msg !== lastAnnounce) {
        lastAnnounce = msg;
        $('#sr-status').textContent = msg;
      }
    }, 400);
  });

  $('#about-link').onclick = () => showAboutPanel(generated);

  // bottom sheets on phones: swipe down on a panel header to dismiss
  const sheetDismiss = (headerEl, close) => {
    let startY = null;
    headerEl.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    headerEl.addEventListener('touchmove', (e) => {
      if (startY !== null && e.touches[0].clientY - startY > 70) {
        startY = null;
        close();
      }
    }, { passive: true });
    headerEl.addEventListener('touchend', () => { startY = null; });
  };
  sheetDismiss($('#card-rail .rail-header'), () => {
    if (store.select.railMode() === 'search') store.actions.setSearch('');
    else store.actions.selectRegion(null);
  });
  sheetDismiss($('#passport-drawer .rail-header'), () => store.actions.closePassport());

  // single writer for the shared right-edge layout state
  const syncRailOpen = () => {
    const { passportOpen } = store.getState();
    document.body.classList.toggle('rail-open', !!store.select.railMode() || passportOpen);
  };
  store.subscribe(syncRailOpen);
  syncRailOpen();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const about = $('#about-panel');
      if (about && !about.hidden) {
        about.hidden = true;
        $('#about-link').focus();
        return;
      }
      const { region, passportOpen, compareOpen, search } = store.getState();
      if (compareOpen) store.actions.setCompareOpen(false);
      else if (passportOpen) store.actions.closePassport();
      else if (region) store.actions.selectRegion(null);
      else if (search) store.actions.setSearch('');
    }
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      setCollapsed(false);
      $('#search-input').focus();
    }
  });
}

/** "About this data" panel: how the catalog is made and kept honest. */
function showAboutPanel(generated) {
  let panel = $('#about-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'about-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'About this data');
    panel.innerHTML = `
      <div class="compare-inner">
        <header class="rail-header">
          <div><h2 tabindex="-1">${icon('shield')} About this data</h2></div>
          <button id="about-close" title="Close" aria-label="Close">${icon('close')}</button>
        </header>
        <div class="about-body">
          <p><b>Every entry is verified twice before it ships.</b> Datasets are curated by
          domain librarians, then an independent adversarial pass re-fetches every URL and
          cross-checks license, coverage and freshness against the source page. Entries that
          fail are dropped.</p>
          <p><b>The catalog re-verifies itself weekly.</b> An automated job checks that every
          link is still alive and pulls last-modified dates from source APIs (World Bank, CKAN
          portals, GitHub, figshare). Changes arrive as reviewed updates
          ${generated ? `— last refresh <b>${esc(generated)}</b>.` : '.'}</p>
          <p><b>Shield badges</b> on cards show when a dataset's link was last verified.
          <b>DNA bars</b> compare freshness, coverage span, granularity, size and license
          openness — tap any bar for the exact value. <b>Lock badges</b> warn about
          account or sign-up requirements before you leave the atlas.</p>
          <p>Source and pipeline: <a href="https://github.com/santoshshinde2012/dataset-atlas" target="_blank" rel="noopener">github.com/santoshshinde2012/dataset-atlas</a></p>
        </div>
      </div>`;
    document.body.appendChild(panel);
    const close = () => {
      panel.hidden = true;
      $('#about-link').focus(); // return focus to the opener
    };
    panel.onclick = (e) => { if (e.target === panel) close(); };
    panel.querySelector('#about-close').onclick = close;
  }
  panel.hidden = false;
  panel.querySelector('h2').focus({ preventScroll: true });
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('boot-fallback').hidden = false;
});
