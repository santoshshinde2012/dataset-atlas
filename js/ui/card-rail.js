/** Right card rail: the selected region's datasets, or search-anywhere
 * results grouped by region when a query is typed with no region open. */
import { searchExplanation, parseQuery } from '../search.js';
import { REGION_META, DOMAIN_META, SOURCE_TYPE_META, GLOBAL_REGION, THEMES, domainColor } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc } from '../utils/text.js';
import { dnaMetrics } from '../dna.js';
import { domainCounts } from '../filters.js';
import { icon } from '../icons.js';
import { bibtexFor } from '../citation.js';
import { accessRequirement } from '../access.js';
import { accessAction } from '../resource.js';
import { countryCoverage } from '../coverage.js';
import { licenseUse, licenseUseSummary, licenseBadgeText } from '../license-use.js';
import { linkHealth } from '../link-health.js';

export function initCardRail({ store, toast, copyText, countryNames = {}, generated = null, onDetails = () => {} }) {
  const rail = $('#card-rail');
  const list = $('#card-list');
  let lastRenderedKey = null; // render signature, so pin toggles keep scroll/focus
  let wasOpen = false;

  $('#rail-close').onclick = () => {
    store.actions.closeResults();
  };
  $('#global-pill').onclick = () => {
    const { region } = store.getState();
    store.actions.selectRegion(region === GLOBAL_REGION ? null : GLOBAL_REGION);
  };
  $('#results-search').oninput = (event) => store.actions.setSearch(event.target.value);
  $('#results-domain').onchange = (event) => store.actions.setDomain(event.target.value);
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
      if (wasOpen && rail.contains(document.activeElement)) $('#global-pill').focus({ preventScroll: true });
      rail.hidden = true;
      lastRenderedKey = null;
      wasOpen = false;
      return;
    }
    rail.hidden = false;
    $('#hint').classList.add('hidden');
    $('#sort-select').value = state.sort;
    if ($('#results-search').value !== state.search) $('#results-search').value = state.search;
    $('#results-search').placeholder = region === GLOBAL_REGION ? 'Search global datasets…' : 'Search this collection…';

    const datasets = mode === 'region'
      ? store.select.regionDatasets(region)
      : store.select.searchResults();

    const key = JSON.stringify([
      mode, region, state.domain, state.focusCountry, state.focusDataset, state.theme, state.sort,
      state.onlyChanged, state.country, state.startYear, state.endYear, state.level, state.resourceKind, state.coverageMode, state.reuse, [...state.sourceTypes].sort(), [...state.formats].sort(),
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

    const opened = state.focusDataset
      && list.querySelector(`.card[data-id="${state.focusDataset}"]`);
    if (opened) opened.scrollIntoView({ block: 'nearest' });

    // keyboard/screen-reader users land where the content starts — but never
    // steal focus while the user is typing the search that opened this rail
    if (!wasOpen && !document.activeElement?.closest('#left-rail') && document.activeElement !== $('#passport-btn')) {
      (opened || $('#rail-region-name')).focus({ preventScroll: true });
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
    const taggedCount = state.focusCountry
      ? datasets.filter((d) => countryCoverage(d, state.focusCountry) === 'tagged').length
      : 0;
    const seriesCount = state.focusCountry
      ? datasets.filter((d) => countryCoverage(d, state.focusCountry) === 'series').length
      : 0;
    $('#rail-region-sub').textContent =
      `${datasets.length} dataset${datasets.length === 1 ? '' : 's'}` +
      (focusName && taggedCount ? ` · ${taggedCount} tagged ${focusName}` : '') +
      (focusName && seriesCount ? ` · ${seriesCount} global series` : '') +
      (state.domain !== 'all' ? ` · ${DOMAIN_META[state.domain].name}` : '');
    renderCountryTool(region);
  }

  function renderSearchHeader(state, datasets) {
    $('#rail-region-name').innerHTML = `${icon('search')} Search results`;
    $('#rail-region-sub').textContent =
      `${datasets.length} match${datasets.length === 1 ? '' : 'es'}` + (state.search ? ` for “${state.search}”` : ' for your requirements') + ' across all regions';
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
    const select = $('#results-domain');
    const counts = domainCounts(inScope);
    select.innerHTML = `<option value="all">All domains (${inScope.length})</option>` + Object.entries(DOMAIN_META).map(([key, meta]) => `<option value="${key}">${esc(meta.name)} (${counts[key] || 0})</option>`).join('');
    select.value = activeDomain;
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
    const kindOf = (d) => countryCoverage(d, state.focusCountry);
    const observed = (d) => (state.focusCountry ? store.select.observation(d, state.focusCountry) : null);
    const tagged = focusName ? datasets.filter((d) => kindOf(d) === 'tagged') : [];
    const series = focusName ? datasets.filter((d) => kindOf(d) === 'series') : [];
    const withRows = series.filter((d) => observed(d) && observed(d) !== 'absent');
    const unchecked = series.filter((d) => !observed(d));
    const rest = focusName ? datasets.filter((d) => !kindOf(d)) : datasets;
    if (focusName && (tagged.length || series.length) && rest.length < datasets.length) {
      if (tagged.length) {
        list.appendChild(groupLabel(`Tagged ${focusName}`, tagged.length));
        for (const d of tagged) list.appendChild(datasetCard(d));
      }
      if (withRows.length) {
        list.appendChild(groupLabel(`Global series with rows for ${focusName}`, withRows.length));
        for (const d of withRows) list.appendChild(datasetCard(d));
      }
      if (unchecked.length) {
        list.appendChild(groupLabel(`Global country-year series (candidate for ${focusName})`, unchecked.length));
        for (const d of unchecked) list.appendChild(datasetCard(d));
      }
      if (rest.length) {
        list.appendChild(groupLabel(
          `Region-wide · ${region === GLOBAL_REGION ? 'Global' : REGION_META[region].name}`,
          rest.length));
        for (const d of rest) list.appendChild(datasetCard(d));
      }
      return;
    }
    for (const d of datasets) list.appendChild(datasetCard(d));
  }

  /** Empty state with removable chips naming each active narrowing filter. */
  function renderEmptyState(state) {
    const wrap = el('div', 'empty-state');
    wrap.appendChild(el('p', 'empty-note', state.focusCountry
      ? `No reviewed dataset for ${esc(countryNames[state.focusCountry] || state.focusCountry)} matches these filters. Global series checked with no rows for this country stay hidden.`
      : 'No datasets match the current filters here.'));
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
    for (const key of ['country', 'startYear', 'endYear', 'level', 'resourceKind', 'reuse']) if (state[key]) addChip(`${key}: ${state[key]}`, () => store.actions.setPracticalFilters({ [key]: null }));
    const parsed = parseQuery(state.search);
    if (parsed.startYear) addChip('Search without years', () => store.actions.setSearch(state.search.replace(/\b(?:18|19|20)\d{2}\b/g, '')));
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
      pin.querySelector('.card-action-label').textContent = pinned ? 'Saved' : 'Save';
      pin.setAttribute('aria-label', pin.title); pin.setAttribute('aria-pressed', String(pinned));
      const cmp = card.querySelector('.compare-btn');
      cmp.classList.toggle('pinned', store.getState().compare.has(id));
      cmp.setAttribute('aria-pressed', String(store.getState().compare.has(id)));
    });
  }

  function datasetCard(d) {
    const card = el('article', 'card');
    card.dataset.id = d.id;
    const state = store.getState();
    const country = state.country || state.focusCountry;
    if (state.focusDataset === d.id) {
      card.classList.add('card-target');
      card.tabIndex = -1;
      card.setAttribute('aria-current', 'true');
    }
    const theme = state.theme;
    const dm = DOMAIN_META[d.domain] || {};
    const dmColor = domainColor(d.domain, theme);

    const top = el('div', 'card-top');
    top.appendChild(el('h3', 'card-title', esc(d.title)));

    const cite = el('button', 'card-icon-btn', icon('quote'));
    cite.title = 'Copy BibTeX citation';
    cite.setAttribute('aria-label', `Copy citation for ${d.title}`);
    cite.onclick = () => copyText(
      bibtexFor(d, new Date().toISOString().slice(0, 10)), 'Citation copied (BibTeX)');
    const sourceRow = el('div', 'card-source-row');
    sourceRow.appendChild(el('span', 'card-provider', esc(d.source)));
    const utilities = el('div', 'card-utilities');
    utilities.appendChild(cite);

    const cmp = el('button', 'card-icon-btn compare-btn' + (state.compare.has(d.id) ? ' pinned' : ''), `${icon('compare')}<span class="card-action-label">Compare</span>`);
    cmp.title = 'Add to compare tray';
    cmp.setAttribute('aria-label', `Compare ${d.title}`);
    cmp.onclick = () => {
      if (!store.actions.toggleCompare(d.id)) toast('Compare tray holds 4 datasets');
    };
    cmp.setAttribute('aria-pressed', String(state.compare.has(d.id)));
    utilities.appendChild(cmp);

    const pinned = store.select.isPinned(d.id);
    const pin = el('button', 'card-icon-btn pin-btn' + (pinned ? ' pinned' : ''), `${icon('pin')}<span class="card-action-label">${pinned ? 'Saved' : 'Save'}</span>`);
    pin.title = pinned ? 'Remove from Data Passport' : 'Pin to Data Passport';
    pin.setAttribute('aria-label', pin.title);
    pin.onclick = () => {
      const nowPinned = store.actions.togglePin(d.id);
      toast(nowPinned ? 'Pinned to Data Passport' : 'Removed from Passport');
    };
    pin.setAttribute('aria-pressed', String(pinned));
    utilities.appendChild(pin);
    utilities.setAttribute('role', 'group'); utilities.setAttribute('aria-label', `Research tools for ${d.title}`);
    card.appendChild(sourceRow); card.appendChild(top);

    const badges = el('div', 'card-badges');
    const change = store.select.changeKind(d.id);
    if (change) {
      badges.appendChild(el('span', 'badge change-badge', `${icon('sparkles')} ${change === 'new' ? 'New' : 'Updated'}`));
    }
    if (country && countryCoverage(d, country) === 'tagged') {
      badges.appendChild(el('span', 'badge country-badge', esc(countryNames[country] || country)));
    } else if (country && countryCoverage(d, country) === 'series') {
      const obs = store.select.observation(d, country);
      if (obs && obs !== 'absent') {
        const series = el('span', 'badge series-badge', `rows ${obs.start}–${obs.end}`);
        series.title = `Checked source rows for ${countryNames[country] || country}: ${obs.start}–${obs.end}. Aggregates excluded. This is not a packaged country extract.`;
        badges.appendChild(series);
      } else {
        const series = el('span', 'badge series-badge', 'country series');
        series.title = 'Global country-year series — this country is a candidate, not a verified row';
        badges.appendChild(series);
      }
    }
    const access = accessRequirement(d);
    if (access) {
      const a = el('span', 'badge access-badge', `${icon('lock')} ${esc(access.label)}`);
      a.title = 'Access requirement before download';
      badges.appendChild(a);
    }
    const domBadge = el('span', 'badge', `${icon(dm.icon || 'file')} ${esc(dm.name || d.domain)}`);
    domBadge.style.setProperty('--badge-color', dmColor || 'var(--muted)');
    badges.appendChild(domBadge);
    for (const f of (d.formats || []).slice(0, 3)) badges.appendChild(el('span', 'badge plain', esc(f)));
    const lic = el('span', 'badge plain', esc(licenseBadgeText(d.license)));
    lic.title = d.licenseUrl ? `${d.license} — ${d.licenseUrl}` : d.license;
    badges.appendChild(lic);
    const evidence = el('details', 'card-evidence');
    evidence.appendChild(el('summary', '', 'Evidence & dataset metrics'));
    const evidenceBody = el('div', 'card-evidence-body');
    const evidenceBadges = el('div', 'card-evidence-badges');
    if (d.verified) {
      const health = linkHealth(d, generated);
      const v = el('span', 'badge ' + (health.status === 'verified' ? 'verified-badge' : health.status === 'stale' ? 'stale-badge' : 'plain'),
        `${icon('shield')} ${esc(health.label)}`);
      v.title = health.title;
      evidenceBadges.appendChild(v);
    } else {
      const health = linkHealth(d, generated);
      const v = el('span', 'badge stale-badge', `${icon('shield')} ${esc(health.label)}`);
      v.title = health.title;
      evidenceBadges.appendChild(v);
    }
    const use = licenseUse(d);
    const reuse = el('span', 'badge plain', 'Reuse');
    reuse.title = licenseUseSummary(use) + '. ' + use.note;
    evidenceBadges.appendChild(reuse);
    if (d.sourceModifiedYear) {
      const modified = el('span', 'badge plain', `Source changed ${d.sourceModifiedYear}`);
      modified.title = 'Source page, repository, or package activity; dataset content year may differ';
      evidenceBadges.appendChild(modified);
    }
    card.appendChild(badges);

    const yearNote = d.freshnessYear && d.freshnessYear !== d.coverageEnd
      ? `Data ${d.coverageStart}–${d.coverageEnd} · Reviewed ${d.freshnessYear}`
      : `Data ${d.coverageStart}–${d.coverageEnd}`;
    const years = el('p', 'card-years', esc(yearNote));
    evidenceBody.appendChild(el('p', 'card-date-explanation', 'Coverage is the data span. Reviewed is the editorial content year; link checks are recorded separately.'));
    card.appendChild(years);
    const description = el('p', 'card-desc', esc(d.description));
    if (d.description.length > 180) {
      description.classList.add('description-preview'); description.id = `description-${d.id}`;
      const expand = el('button', 'description-toggle', 'Read more');
      expand.setAttribute('aria-expanded', 'false'); expand.setAttribute('aria-controls', description.id);
      expand.onclick = () => { const open = expand.getAttribute('aria-expanded') !== 'true'; expand.setAttribute('aria-expanded', String(open)); description.classList.toggle('description-preview', !open); expand.textContent = open ? 'Show less' : 'Read more'; };
      card.appendChild(description); card.appendChild(expand);
    } else card.appendChild(description);
    if (state.search) card.appendChild(el('p', 'match-reasons', esc(searchExplanation(d, state.search, state.coverageIndex).join(' · '))));
    if (d.sample?.rows?.length) {
      const details = el('details', 'card-sample');
      const summary = document.createElement('summary');
      summary.textContent = 'Sample rows';
      details.appendChild(summary);
      const pre = document.createElement('pre');
      pre.textContent = [
        d.sample.columns.join(' | '),
        ...d.sample.rows.map((row) => row.join(' | ')),
      ].join('\n');
      details.appendChild(pre);
      card.appendChild(details);
    }
    evidenceBody.appendChild(evidenceBadges);
    evidenceBody.appendChild(el('p', 'card-reuse-note', esc(licenseUseSummary(use) + '. ' + use.note)));
    evidenceBody.appendChild(dnaStrip(d)); evidence.appendChild(evidenceBody);
    card.appendChild(evidence);

    const actions = el('div', 'card-actions');
    const action = accessAction(d);
    const get = el('a', 'get-btn' + (action.primary.kind === 'page' ? ' page' : ''), `${esc(action.primary.label)} ${icon('external')}`);
    get.href = action.primary.href;
    get.target = '_blank';
    get.rel = 'noopener';
    actions.appendChild(get);
    if (action.secondary) {
      const src = el('a', 'cli-btn', `${esc(action.secondary.label)} ${icon('external')}`);
      src.href = action.secondary.href;
      src.target = '_blank';
      src.rel = 'noopener';
      actions.appendChild(src);
    }
    const cli = el('button', 'cli-btn card-icon-btn copy-btn', icon(action.copy.kind === 'cli' ? 'terminal' : 'copy'));
    cli.setAttribute('aria-label', `${action.copy.label} for ${d.title}`);
    cli.title = action.copy.text;
    cli.onclick = () => {
      copyText(action.copy.text, action.copy.kind === 'cli' ? 'Kaggle CLI command copied' : 'Link copied');
      cli.classList.add('copied');
      cli.innerHTML = icon('check');
      setTimeout(() => {
        cli.classList.remove('copied');
        cli.innerHTML = icon(action.copy.kind === 'cli' ? 'terminal' : 'copy');
      }, 1600);
    };
    utilities.insertBefore(cli, utilities.firstChild);
    const detail = el('button', 'cli-btn detail-btn', 'View details');
    detail.onclick = () => onDetails(d.id);
    actions.insertBefore(detail, actions.children[1] || null);
    card.appendChild(actions);
    card.appendChild(utilities);

    return card;
  }

  function dnaStrip(d) {
    const strip = el('div', 'dna');
    for (const { label, value, tip } of dnaMetrics(d)) {
      const bar = el('button', 'dna-bar');
      bar.type = 'button'; bar.setAttribute('aria-label', tip);
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
