/** Right card rail: the selected region's dataset cards. */
import { REGION_META, DOMAIN_META, SOURCE_TYPE_META, GLOBAL_REGION, ACCENT_COLOR, ACCENT_DEEP } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc } from '../utils/text.js';
import { dnaMetrics } from '../dna.js';
import { domainCounts } from '../filters.js';
import { icon } from '../icons.js';

export function initCardRail({ store, toast, copyText, countryNames = {} }) {
  const rail = $('#card-rail');
  const list = $('#card-list');
  let lastRenderedKey = null; // region + filter signature, to keep scroll on pin toggles

  $('#rail-close').onclick = () => store.actions.selectRegion(null);
  $('#global-pill').onclick = () => {
    const { region } = store.getState();
    store.actions.selectRegion(region === GLOBAL_REGION ? null : GLOBAL_REGION);
  };

  function render() {
    const state = store.getState();
    const region = state.region;

    $('#global-pill').classList.toggle('selected', region === GLOBAL_REGION);
    $('#global-count').textContent = store.select.regionCounts()[GLOBAL_REGION];

    if (!region) {
      rail.hidden = true;
      lastRenderedKey = null;
      return;
    }
    rail.hidden = false;
    $('#hint').classList.add('hidden');

    const datasets = store.select.regionDatasets(region);
    // pin toggles notify the store but must not rebuild the list (scroll/focus);
    // the signature covers every filter input — not just the visible ids —
    // because the domain-breakdown counts depend on facets even when the
    // visible list happens to be unchanged
    const key = JSON.stringify([
      region,
      state.domain,
      state.focusCountry,
      [...state.sourceTypes].sort(),
      [...state.formats].sort(),
      state.minOpenness,
      state.search,
      datasets.map((d) => d.id),
    ]);
    if (key === lastRenderedKey) {
      updatePinButtons();
      return;
    }
    lastRenderedKey = key;

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

    renderDomainBreakdown(region, state.domain);

    list.innerHTML = '';
    if (!datasets.length) {
      list.appendChild(el('p', 'empty-note',
        'No datasets match the current filters here.<br>Try widening domain or source filters.'));
      return;
    }
    for (const d of datasets) list.appendChild(datasetCard(d));
  }

  function renderDomainBreakdown(region, activeDomain) {
    const inRegion = store.select.catalog()
      .filter((d) => d.region === region && store.select.matches(d, ['domain']));
    const bd = $('#rail-domain-breakdown');
    bd.innerHTML = '';
    for (const [key, n] of Object.entries(domainCounts(inRegion)).sort((a, b) => b[1] - a[1])) {
      const m = DOMAIN_META[key];
      const chip = el('button', 'chip' + (activeDomain === key ? ' active' : ''));
      chip.style.setProperty('--chip-color', m.color);
      chip.innerHTML = `${icon(m.icon)} ${esc(m.name)} <span class="chip-count">${n}</span>`;
      chip.onclick = () => store.actions.setDomain(activeDomain === key ? 'all' : key);
      bd.appendChild(chip);
    }
  }

  function updatePinButtons() {
    list.querySelectorAll('.card').forEach((card) => {
      const pinned = store.select.isPinned(card.dataset.id);
      const btn = card.querySelector('.pin-btn');
      btn.classList.toggle('pinned', pinned);
      btn.title = pinned ? 'Remove from Data Passport' : 'Pin to Data Passport';
    });
  }

  function datasetCard(d) {
    const card = el('article', 'card');
    card.dataset.id = d.id;
    const dm = DOMAIN_META[d.domain] || {};
    const sm = SOURCE_TYPE_META[d.sourceType] || {};
    const pinned = store.select.isPinned(d.id);

    const top = el('div', 'card-top');
    top.appendChild(el('h3', 'card-title', esc(d.title)));
    const pin = el('button', 'pin-btn' + (pinned ? ' pinned' : ''), icon('pin'));
    pin.title = pinned ? 'Remove from Data Passport' : 'Pin to Data Passport';
    pin.setAttribute('aria-label', pin.title);
    pin.onclick = () => {
      const nowPinned = store.actions.togglePin(d.id);
      toast(nowPinned ? 'Pinned to Data Passport' : 'Removed from Passport');
    };
    top.appendChild(pin);
    card.appendChild(top);

    const badges = el('div', 'card-badges');
    const state = store.getState();
    if (state.focusCountry && (d.countries || []).includes(state.focusCountry)) {
      const cb = el('span', 'badge country-badge', esc(countryNames[state.focusCountry] || state.focusCountry));
      badges.appendChild(cb);
    }
    const srcBadge = el('span', 'badge', esc(d.source));
    srcBadge.style.setProperty('--badge-color', sm.color || 'var(--muted)');
    badges.appendChild(srcBadge);
    const domBadge = el('span', 'badge', `${icon(dm.icon || 'file')} ${esc(dm.name || d.domain)}`);
    domBadge.style.setProperty('--badge-color', dm.color || 'var(--muted)');
    badges.appendChild(domBadge);
    for (const f of (d.formats || []).slice(0, 3)) badges.appendChild(el('span', 'badge plain', esc(f)));
    badges.appendChild(el('span', 'badge plain', esc(d.license)));
    card.appendChild(badges);

    card.appendChild(el('p', 'card-desc', esc(d.description)));
    card.appendChild(dnaStrip(d));

    const actions = el('div', 'card-actions');
    const get = el('a', 'get-btn', `Get data ${icon('external')}`);
    get.href = d.url;
    get.target = '_blank';
    get.rel = 'noopener';
    actions.appendChild(get);
    const cli = el('button', 'cli-btn',
      d.kaggleRef ? `${icon('terminal')} Copy CLI` : `${icon('copy')} Copy link`);
    cli.title = d.kaggleRef
      ? `Copy: kaggle datasets download -d ${d.kaggleRef}`
      : 'Copy dataset URL';
    cli.onclick = () => copyText(
      d.kaggleRef ? `kaggle datasets download -d ${d.kaggleRef}` : d.url,
      d.kaggleRef ? 'Kaggle CLI command copied' : 'Link copied');
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
      fill.style.background = `color-mix(in srgb, ${ACCENT_COLOR} ${Math.round(30 + value * 70)}%, ${ACCENT_DEEP})`;
      bar.appendChild(fill);
      bar.appendChild(el('span', '', label));
      strip.appendChild(bar);
    }
    return strip;
  }

  store.subscribe(render);
  render();
}
