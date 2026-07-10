/** Right card rail: the selected region's datasets, or search-anywhere
 * results grouped by region when a query is typed with no region open. */
import { REGION_META, DOMAIN_META, SOURCE_TYPE_META, GLOBAL_REGION, THEMES, domainColor } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc } from '../utils/text.js';
import { dnaMetrics } from '../dna.js';
import { domainCounts } from '../filters.js';
import { icon } from '../icons.js';
import { bibtexFor } from '../citation.js';
import { accessRequirement } from '../access.js';

export function initCardRail({ store, toast, copyText, countryNames = {} }) {
  const rail = $('#card-rail');
  const list = $('#card-list');
  let lastRenderedKey = null; // render signature, so pin toggles keep scroll/focus
  let wasOpen = false;

  $('#rail-close').onclick = () => {
    if (store.select.railMode() === 'search') store.actions.setSearch('');
    else store.actions.selectRegion(null);
  };
  $('#global-pill').onclick = () => {
    const { region } = store.getState();
    store.actions.selectRegion(region === GLOBAL_REGION ? null : GLOBAL_REGION);
  };
  $('#sort-select').onchange = (e) => store.actions.setSort(e.target.value);
  $('#country-select').onchange = (e) => {
    const { region } = store.getState();
    store.actions.selectRegion(region, e.target.value || null);
  };

  function render() {
    const state = store.getState();
    const mode = store.select.railMode();
    const region = state.region;

    $('#global-pill').classList.toggle('selected', region === GLOBAL_REGION);
    $('#global-count').textContent = store.select.regionCounts()[GLOBAL_REGION];

    if (!mode) {
      rail.hidden = true;
      lastRenderedKey = null;
      wasOpen = false;
      return;
    }
    rail.hidden = false;
    $('#hint').classList.add('hidden');
    $('#sort-select').value = state.sort;

    const datasets = mode === 'region'
      ? store.select.regionDatasets(region)
      : store.select.searchResults();

    const key = JSON.stringify([
      mode, region, state.domain, state.focusCountry, state.theme, state.sort,
      state.onlyChanged, [...state.sourceTypes].sort(), [...state.formats].sort(),
      state.minOpenness, state.search, datasets.map((d) => d.id),
    ]);
    if (key === lastRenderedKey) {
      updateCardButtons();
      return;
    }
    lastRenderedKey = key;

    if (mode === 'region') renderRegionHeader(state, region, datasets);
    else renderSearchHeader(state, datasets);

    renderDomainBreakdown(mode === 'region'
      ? store.select.catalog().filter((d) => d.region === region && store.select.matches(d, ['domain']))
      : store.select.catalog().filter((d) => store.select.matches(d, ['domain'])),
      state.domain);

    renderList(state, mode, region, datasets);

    // keyboard/screen-reader users land where the content starts — but never
    // steal focus while the user is typing the search that opened this rail
    if (!wasOpen && document.activeElement !== $('#search-input')) {
      $('#rail-region-name').focus({ preventScroll: true });
    }
    wasOpen = true;
  }

  /* ---------- headers ---------- */

  function renderRegionHeader(state, region, datasets) {
    const isGlobal = region === GLOBAL_REGION;
    $('#rail-region-name').innerHTML = isGlobal
      ? `${icon('globe')} Global datasets`
      : esc(REGION_META[region].name);
    const focusName = state.focusCountry ? countryNames[state.focusCountry] : null;
    const focusCount = state.focusCountry
      ? datasets.filter((d) => (d.countries || []).includes(state.focusCountry)).length
      : 0;
    $('#rail-region-sub').textContent =
      `${datasets.length} dataset${datasets.length === 1 ? '' : 's'}` +
      (focusName && focusCount ? ` · ${focusCount} specific to ${focusName}` : '') +
      (state.domain !== 'all' ? ` · ${DOMAIN_META[state.domain].name}` : '');
    renderCountryTool(region);
  }

  function renderSearchHeader(state, datasets) {
    $('#rail-region-name').innerHTML = `${icon('search')} Search results`;
    $('#rail-region-sub').textContent =
      `${datasets.length} match${datasets.length === 1 ? '' : 'es'} for “${state.search}” across all regions`;
    $('#country-tool').hidden = true;
  }

  /** Keyboard-friendly (and mouse-friendly) country focus for the region. */
  function renderCountryTool(region) {
    const tool = $('#country-tool');
    if (region === GLOBAL_REGION) { tool.hidden = true; return; }
    const select = $('#country-select');
    const tagged = new Map(); // cca2 -> count in this region
    for (const d of store.select.catalog()) {
      if (d.region !== region) continue;
      for (const c of d.countries || []) tagged.set(c, (tagged.get(c) || 0) + 1);
    }
    if (!tagged.size) { tool.hidden = true; return; }
    tool.hidden = false;
    const current = store.getState().focusCountry;
    const options = [...tagged.entries()]
      .map(([c, n]) => ({ c, n, name: countryNames[c] || c }))
      .sort((a, b) => a.name.localeCompare(b.name));
    select.innerHTML = `<option value="">Whole region</option>` +
      options.map((o) =>
        `<option value="${o.c}"${o.c === current ? ' selected' : ''}>${esc(o.name)} (${o.n})</option>`).join('');
  }

  function renderDomainBreakdown(inScope, activeDomain) {
    const bd = $('#rail-domain-breakdown');
    bd.innerHTML = '';
    const theme = store.getState().theme;
    for (const [key, n] of Object.entries(domainCounts(inScope)).sort((a, b) => b[1] - a[1])) {
      const m = DOMAIN_META[key];
      const chip = el('button', 'chip' + (activeDomain === key ? ' active' : ''));
      chip.style.setProperty('--chip-color', domainColor(key, theme));
      chip.innerHTML = `${icon(m.icon)} ${esc(m.name)} <span class="chip-count">${n}</span>`;
      chip.onclick = () => store.actions.setDomain(activeDomain === key ? 'all' : key);
      bd.appendChild(chip);
    }
  }

  /* ---------- list ---------- */

  function renderList(state, mode, region, datasets) {
    list.innerHTML = '';
    if (!datasets.length) {
      renderEmptyState(state);
      return;
    }

    if (mode === 'search') {
      // group results by region so geography stays legible
      const groups = new Map();
      for (const d of datasets) (groups.get(d.region) || groups.set(d.region, []).get(d.region)).push(d);
      const order = [GLOBAL_REGION, ...Object.keys(REGION_META)];
      for (const r of order) {
        const items = groups.get(r);
        if (!items) continue;
        const name = r === GLOBAL_REGION ? 'Global' : REGION_META[r].name;
        list.appendChild(groupLabel(name, items.length));
        for (const d of items) list.appendChild(datasetCard(d));
      }
      return;
    }

    const focusName = state.focusCountry ? countryNames[state.focusCountry] : null;
    const coversFocus = (d) => (d.countries || []).includes(state.focusCountry);
    const focusCount = focusName ? datasets.filter(coversFocus).length : 0;
    if (focusName && focusCount > 0 && focusCount < datasets.length) {
      list.appendChild(groupLabel(`Specific to ${focusName}`, focusCount));
      for (const d of datasets.filter(coversFocus)) list.appendChild(datasetCard(d));
      list.appendChild(groupLabel(
        `Region-wide · ${region === GLOBAL_REGION ? 'Global' : REGION_META[region].name}`,
        datasets.length - focusCount));
      for (const d of datasets.filter((d) => !coversFocus(d))) list.appendChild(datasetCard(d));
      return;
    }
    for (const d of datasets) list.appendChild(datasetCard(d));
  }

  /** Empty state with removable chips naming each active narrowing filter. */
  function renderEmptyState(state) {
    const wrap = el('div', 'empty-state');
    wrap.appendChild(el('p', 'empty-note', 'No datasets match the current filters here.'));
    const chips = el('div', 'active-filter-chips');

    const addChip = (label, clear) => {
      const c = el('button', 'filter-chip');
      c.innerHTML = `${esc(label)} ${icon('close')}`;
      c.title = `Remove: ${label}`;
      c.onclick = clear;
      chips.appendChild(c);
    };
    if (state.domain !== 'all') {
      addChip(DOMAIN_META[state.domain].name, () => store.actions.setDomain('all'));
    }
    if (state.search) addChip(`“${state.search}”`, () => store.actions.setSearch(''));
    if (state.minOpenness > 0) addChip('License filter', () => store.actions.setMinOpenness(0));
    if (state.sourceTypes.size < Object.keys(SOURCE_TYPE_META).length) {
      addChip(`Sources ${state.sourceTypes.size}/${Object.keys(SOURCE_TYPE_META).length}`,
        () => store.actions.enableAllSources());
    }
    if (state.formats.size < store.select.allFormats().length) {
      addChip(`Formats ${state.formats.size}/${store.select.allFormats().length}`,
        () => store.actions.enableAllFormats());
    }
    if (state.onlyChanged) addChip('New & updated only', () => store.actions.setOnlyChanged(false));

    if (chips.children.length) wrap.appendChild(chips);
    const reset = el('button', 'filter-chip reset-all', 'Reset all filters');
    reset.onclick = () => store.actions.resetFilters();
    wrap.appendChild(reset);
    list.appendChild(wrap);
  }

  /* ---------- cards ---------- */

  function updateCardButtons() {
    list.querySelectorAll('.card').forEach((card) => {
      const id = card.dataset.id;
      const pin = card.querySelector('.pin-btn');
      const pinned = store.select.isPinned(id);
      pin.classList.toggle('pinned', pinned);
      pin.title = pinned ? 'Remove from Data Passport' : 'Pin to Data Passport';
      const cmp = card.querySelector('.compare-btn');
      cmp.classList.toggle('pinned', store.getState().compare.has(id));
    });
  }

  function datasetCard(d) {
    const card = el('article', 'card');
    card.dataset.id = d.id;
    const state = store.getState();
    const theme = state.theme;
    const dm = DOMAIN_META[d.domain] || {};
    const dmColor = domainColor(d.domain, theme);
    const sm = SOURCE_TYPE_META[d.sourceType] || {};

    const top = el('div', 'card-top');
    top.appendChild(el('h3', 'card-title', esc(d.title)));

    const cite = el('button', 'card-icon-btn', icon('quote'));
    cite.title = 'Copy BibTeX citation';
    cite.setAttribute('aria-label', `Copy citation for ${d.title}`);
    cite.onclick = () => copyText(
      bibtexFor(d, new Date().toISOString().slice(0, 10)), 'Citation copied (BibTeX)');
    top.appendChild(cite);

    const cmp = el('button', 'card-icon-btn compare-btn' + (state.compare.has(d.id) ? ' pinned' : ''), icon('compare'));
    cmp.title = 'Add to compare tray';
    cmp.setAttribute('aria-label', `Compare ${d.title}`);
    cmp.onclick = () => {
      if (!store.actions.toggleCompare(d.id)) toast('Compare tray holds 4 datasets');
    };
    top.appendChild(cmp);

    const pinned = store.select.isPinned(d.id);
    const pin = el('button', 'card-icon-btn pin-btn' + (pinned ? ' pinned' : ''), icon('pin'));
    pin.title = pinned ? 'Remove from Data Passport' : 'Pin to Data Passport';
    pin.setAttribute('aria-label', pin.title);
    pin.onclick = () => {
      const nowPinned = store.actions.togglePin(d.id);
      toast(nowPinned ? 'Pinned to Data Passport' : 'Removed from Passport');
    };
    top.appendChild(pin);
    card.appendChild(top);

    const badges = el('div', 'card-badges');
    const change = store.select.changeKind(d.id);
    if (change) {
      badges.appendChild(el('span', 'badge change-badge', `${icon('sparkles')} ${change === 'new' ? 'New' : 'Updated'}`));
    }
    if (state.focusCountry && (d.countries || []).includes(state.focusCountry)) {
      badges.appendChild(el('span', 'badge country-badge', esc(countryNames[state.focusCountry] || state.focusCountry)));
    }
    const access = accessRequirement(d);
    if (access) {
      const a = el('span', 'badge access-badge', `${icon('lock')} ${esc(access.label)}`);
      a.title = 'Access requirement before download';
      badges.appendChild(a);
    }
    const srcBadge = el('span', 'badge', esc(d.source));
    srcBadge.style.setProperty('--badge-color', sm.color || 'var(--muted)');
    badges.appendChild(srcBadge);
    const domBadge = el('span', 'badge', `${icon(dm.icon || 'file')} ${esc(dm.name || d.domain)}`);
    domBadge.style.setProperty('--badge-color', dmColor || 'var(--muted)');
    badges.appendChild(domBadge);
    for (const f of (d.formats || []).slice(0, 3)) badges.appendChild(el('span', 'badge plain', esc(f)));
    badges.appendChild(el('span', 'badge plain', esc(d.license)));
    if (d.verified) {
      const v = el('span', 'badge verified-badge', `${icon('shield')} ${esc(d.verified)}`);
      v.title = `Link and metadata last verified ${d.verified}`;
      badges.appendChild(v);
    }
    card.appendChild(badges);

    card.appendChild(el('p', 'card-desc', esc(d.description)));
    card.appendChild(dnaStrip(d));

    const actions = el('div', 'card-actions');
    const get = el('a', 'get-btn', `Get data ${icon('external')}`);
    get.href = d.url;
    get.target = '_blank';
    get.rel = 'noopener';
    actions.appendChild(get);
    const cliLabel = d.kaggleRef ? `${icon('terminal')} Copy CLI` : `${icon('copy')} Copy link`;
    const cli = el('button', 'cli-btn', cliLabel);
    cli.title = d.kaggleRef
      ? `Copy: kaggle datasets download -d ${d.kaggleRef}`
      : 'Copy dataset URL';
    cli.onclick = () => {
      copyText(
        d.kaggleRef ? `kaggle datasets download -d ${d.kaggleRef}` : d.url,
        d.kaggleRef ? 'Kaggle CLI command copied' : 'Link copied');
      cli.classList.add('copied');
      cli.innerHTML = `${icon('check')} Copied`;
      setTimeout(() => {
        cli.classList.remove('copied');
        cli.innerHTML = cliLabel;
      }, 1600);
    };
    actions.appendChild(cli);
    card.appendChild(actions);

    return card;
  }

  function dnaStrip(d) {
    const strip = el('div', 'dna');
    for (const { label, value, tip } of dnaMetrics(d)) {
      const bar = el('div', 'dna-bar');
      bar.title = tip;
      bar.onclick = () => toast(tip); // hover-less devices get the detail on tap
      const fill = el('div', 'dna-fill');
      fill.style.height = Math.round(value * 100) + '%';
      const t = THEMES[store.getState().theme];
      fill.style.background = `color-mix(in srgb, ${t.accent} ${Math.round(30 + value * 70)}%, ${t.accentDeep})`;
      bar.appendChild(fill);
      bar.appendChild(el('span', '', label));
      strip.appendChild(bar);
    }
    return strip;
  }

  function groupLabel(text, count) {
    return el('div', 'card-group-label', `${esc(text)} <span>${count}</span>`);
  }

  store.subscribe(render);
  render();
}
