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
import { initFilterRail, setCollapsed } from './ui/filter-rail.js';
import { initCardRail } from './ui/card-rail.js';
import { initPassport } from './ui/passport.js';
import { $ } from './utils/dom.js';
import { icon } from './icons.js';

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

  let storedTheme = null;
  try { storedTheme = localStorage.getItem('atlas-theme'); } catch { /* session-only */ }
  const store = createStore({
    catalog,
    pinStorage: localPinStorage,
    initialTheme: THEMES[storedTheme] ? storedTheme : DEFAULT_THEME,
  });

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
  initFilterRail({ store, generated });
  initCardRail({ store, toast, copyText, countryNames });

  // single writer for the shared right-edge layout state
  const syncRailOpen = () => {
    const { region, passportOpen } = store.getState();
    document.body.classList.toggle('rail-open', !!region || passportOpen);
  };
  store.subscribe(syncRailOpen);
  syncRailOpen();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const { region, passportOpen } = store.getState();
      if (passportOpen) store.actions.closePassport();
      else if (region) store.actions.selectRegion(null);
    }
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      setCollapsed(false);
      $('#search-input').focus();
    }
  });
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('boot-fallback').hidden = false;
});
