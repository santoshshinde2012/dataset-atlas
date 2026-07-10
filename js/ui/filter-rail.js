/** Left rail: search, use-case presets, facet checkboxes, license slider. */
import { SOURCE_TYPE_META, PRESETS, LICENSE_LABELS, REGION_META } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc, normFormat } from '../utils/text.js';

export function initFilterRail({ store }) {
  buildPresets(store);
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
  if (innerWidth < 700) setCollapsed(true); // map-first on small screens

  function render() {
    const state = store.getState();

    [...$('#preset-list').children].forEach((b, i) =>
      b.classList.toggle('active', state.preset === i));

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
  }

  store.subscribe(render);
  render();
}

export function setCollapsed(collapsed) {
  $('#left-rail').classList.toggle('collapsed', collapsed);
  $('#rail-expand').hidden = !collapsed;
}

function buildPresets(store) {
  const box = $('#preset-list');
  PRESETS.forEach((p, i) => {
    const b = el('button', 'preset');
    b.innerHTML = `${esc(p.label)}<small>${esc(p.sub)}</small>`;
    b.onclick = () => store.actions.togglePreset(i);
    box.appendChild(b);
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
