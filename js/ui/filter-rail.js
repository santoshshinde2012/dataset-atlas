/** Left rail: search, use-case presets, facet checkboxes, license slider. */
import { SOURCE_TYPE_META, PRESETS, LICENSE_LABELS, REGION_META } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc, normFormat } from '../utils/text.js';

export function initFilterRail({ store, generated = null, toast = () => {} }) {
  if (generated) {
    $('#catalog-stamp').textContent = `Catalog refreshed ${generated}`;
    $('#catalog-stamp').hidden = false;
  }
  buildPresets(store, toast);
  buildFacet(
    $('#source-filters'),
    Object.entries(SOURCE_TYPE_META).map(([k, m]) => [k, m.name]),
    (key, on) => store.actions.toggleSourceType(key, on)
  );
  buildFacet(
    $('#format-filters'),
    store.select.allFormats().map((f) => [f, f]),
    (key, on) => store.actions.toggleFormat(key, on)
  );

  $('#search-input').oninput = (e) => store.actions.setSearch(e.target.value);
  $('#license-slider').oninput = (e) => store.actions.setMinOpenness(e.target.value);
  $('#reset-filters').onclick = () => {
    $('#search-input').value = '';
    $('#license-slider').value = 0;
    store.actions.resetFilters();
  };

  $('#rail-collapse').onclick = () => setCollapsed(true);
  $('#rail-expand').onclick = () => setCollapsed(false);
  $('#changes-pill').onclick = () =>
    store.actions.setOnlyChanged(!store.getState().onlyChanged);
  if (innerWidth < 700) setCollapsed(true); // map-first on small screens

  function render() {
    const state = store.getState();

    // inputs mirror store state so URL-restored or programmatic changes show
    if ($('#search-input').value !== state.search) $('#search-input').value = state.search;
    if (+$('#license-slider').value !== state.minOpenness) $('#license-slider').value = state.minOpenness;

    [...$('#preset-list').children].forEach((wrap, i) => {
      const active = state.preset === i;
      wrap.querySelector('.preset').classList.toggle('active', active);
      const bundleBtn = wrap.querySelector('.bundle-btn');
      if (bundleBtn) bundleBtn.hidden = !active;
    });

    // "new since your last visit" pill under the tally
    const pill = $('#changes-pill');
    const changeCount = store.select.changeCount();
    pill.hidden = changeCount === 0;
    if (changeCount) {
      pill.classList.toggle('active', state.onlyChanged);
      pill.querySelector('span:last-child').textContent =
        `${changeCount} new or updated since your last visit`;
    }

    updateFacet($('#source-filters'), state.sourceTypes, (key) =>
      store.select.catalog().filter((d) => d.sourceType === key && store.select.matches(d, ['source'])).length);
    updateFacet($('#format-filters'), state.formats, (key) =>
      store.select.catalog().filter((d) =>
        (d.formats || []).some((f) => normFormat(f) === key) && store.select.matches(d, ['format'])).length);

    $('#license-label').textContent =
      LICENSE_LABELS[String(state.minOpenness)] || `≥ ${state.minOpenness}`;

    const counts = store.select.regionCounts();
    const covered = Object.keys(REGION_META).filter((k) => counts[k] > 0).length;
    $('#tally').textContent =
      `${store.select.filtered().length} datasets · ${covered}/${Object.keys(REGION_META).length} regions covered`;

    // active-filter count on the collapsed-rail button, so narrowing is
    // never invisible when the panel is closed
    const active =
      (state.domain !== 'all' ? 1 : 0) +
      (state.sourceTypes.size < Object.keys(SOURCE_TYPE_META).length ? 1 : 0) +
      (state.formats.size < store.select.allFormats().length ? 1 : 0) +
      (state.minOpenness > 0 ? 1 : 0) +
      (state.search ? 1 : 0);
    const badge = $('#filter-badge');
    badge.textContent = active;
    badge.hidden = active === 0;
  }

  store.subscribe(render);
  render();
}

export function setCollapsed(collapsed) {
  $('#left-rail').classList.toggle('collapsed', collapsed);
  $('#rail-expand').hidden = !collapsed;
}

function buildPresets(store, toast) {
  const box = $('#preset-list');
  PRESETS.forEach((p, i) => {
    const wrap = el('div', 'preset-wrap');
    const b = el('button', 'preset');
    b.innerHTML = `${esc(p.label)}<small>${esc(p.sub)}</small>`;
    b.onclick = () => store.actions.togglePreset(i);
    wrap.appendChild(b);
    if (p.bundle && p.bundle.length) {
      // the concept-C payoff: one click pins the whole starter kit
      const bundleBtn = el('button', 'bundle-btn', `Pin starter bundle · ${p.bundle.length}`);
      bundleBtn.hidden = true;
      bundleBtn.onclick = () => {
        const ids = store.select.presetBundleIds(i);
        const added = store.actions.importPins(ids);
        toast(added
          ? `Pinned ${added} starter dataset${added === 1 ? '' : 's'} to your Passport`
          : 'Starter bundle is already in your Passport');
        store.actions.openPassport();
      };
      wrap.appendChild(bundleBtn);
    }
    box.appendChild(wrap);
  });
}

function buildFacet(box, entries, onToggle) {
  for (const [key, label] of entries) {
    const row = el('label', 'filter-row');
    row.dataset.key = key;
    const cb = el('input');
    cb.type = 'checkbox';
    cb.onchange = () => onToggle(key, cb.checked);
    row.appendChild(cb);
    row.appendChild(el('span', '', esc(label)));
    row.appendChild(el('span', 'filter-count', ''));
    box.appendChild(row);
  }
}

function updateFacet(box, activeSet, countFn) {
  for (const row of box.children) {
    row.querySelector('input').checked = activeSet.has(row.dataset.key);
    row.querySelector('.filter-count').textContent = String(countFn(row.dataset.key));
  }
}
