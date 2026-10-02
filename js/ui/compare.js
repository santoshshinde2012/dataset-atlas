import { assessJoinByIds } from '../fit.js';
import { profileFor } from '../dataset.js';
import { trapModalFocus } from './focus-trap.js';
/** Compare tray: up to four shortlisted datasets side by side, every column
 * still one click from download or pin. */
import { DOMAIN_META, REGION_META, GLOBAL_REGION, domainColor } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc, sizeLabel } from '../utils/text.js';
import { icon } from '../icons.js';
import { accessRequirement } from '../access.js';
import { accessAction } from '../resource.js';
import { licenseUseSummary, licenseUse } from '../license-use.js';

export function initCompare({ store, toast, pilot, onProject = () => {} }) {
  const tray = $('#compare-tray');
  const modal = $('#compare-modal');
  const wrap = $('#compare-table-wrap');

  let opener = tray;
  tray.onclick = () => { opener = tray; store.actions.setCompareOpen(true); };
  $('#results-compare').onclick = () => { opener = $('#results-compare'); store.actions.setCompareOpen(true); };
  $('#compare-close').onclick = () => store.actions.setCompareOpen(false);
  modal.onclick = (e) => { if (e.target === modal) store.actions.setCompareOpen(false); };

  modal.addEventListener('close', () => { if (store.getState().compareOpen) store.actions.setCompareOpen(false); const headerControl = $('#results-compare');
    const target = opener.isConnected && opener.getClientRects().length ? opener : !headerControl.hidden && headerControl.getClientRects().length ? headerControl : tray.getClientRects().length ? tray : $('#global-pill');
    target.focus(); });
  modal.addEventListener('keydown', (e) => trapModalFocus(modal, e));
  let lastKey = null;

  function render() {
    const state = store.getState();
    const items = store.select.compareDatasets();
    tray.hidden = items.length === 0;
    $('#compare-count').textContent = items.length;
    $('#results-compare').hidden = !items.length;
    $('#results-compare-count').textContent = items.length;

    const shouldShow = state.compareOpen && items.length > 0;
    if (!shouldShow) { if (modal.open) modal.close(); lastKey = null; return; }
    if (!modal.open) modal.showModal();

    // rebuild only when the compared set or theme changes — unrelated store
    // notifications must not wipe the table (and any keyboard focus in it)
    const key = JSON.stringify([items.map((d) => d.id), state.theme]);
    if (key === lastKey) return;
    lastKey = key;

    const theme = state.theme;
    const row = (label, cell) =>
      `<tr><th scope="row">${esc(label)}</th>${items.map((d) => `<td>${cell(d)}</td>`).join('')}</tr>`;

    wrap.innerHTML = `<table class="compare-table">
      <thead><tr><th></th>${items.map((d) => `
        <th scope="col">
          <span class="compare-domain" style="color:${domainColor(d.domain, theme)}">${icon(DOMAIN_META[d.domain].icon)} ${esc(DOMAIN_META[d.domain].name)}</span>
          <div class="compare-name">${esc(d.title)}</div>
        </th>`).join('')}</tr></thead>
      <tbody>
        ${row('Source', (d) => esc(d.source))}
        ${row('Region', (d) => esc(d.region === GLOBAL_REGION ? 'Global' : REGION_META[d.region]?.name || d.region))}
        ${row('License', (d) => esc(d.license))}
        ${row('Reuse', (d) => esc(licenseUseSummary(licenseUse(d))))}
        ${row('Coverage', (d) => `${d.coverageStart}–${d.coverageEnd}`)}
        ${row('Content year', (d) => String(d.freshnessYear))}
        ${row('Granularity', (d) => esc(d.granularity))}
        ${row('Size', (d) => `~${sizeLabel(d.approxSizeMB)}`)}
        ${row('Formats', (d) => esc((d.formats || []).join(', ')))}
        ${row('Access', (d) => { const a = accessRequirement(d); return a ? esc(a.label) : 'Check source'; })}
      </tbody>
      <tfoot><tr><th></th>${items.map((d) => `
        <td class="compare-actions-cell" data-id="${esc(d.id)}">
          <a class="get-btn${accessAction(d).primary.kind === 'page' ? ' page' : ''}" href="${esc(accessAction(d).primary.href)}" target="_blank" rel="noopener">${esc(accessAction(d).primary.label)} ${icon('external')}</a>
          <button class="compare-remove" title="Remove from comparison" aria-label="Remove ${esc(d.title)}">${icon('close')}</button>
        </td>`).join('')}</tr></tfoot>
    </table>`;

    wrap.querySelectorAll('.compare-remove').forEach((btn) => {
      btn.onclick = () => store.actions.toggleCompare(btn.closest('[data-id]').dataset.id);
    });
    // after any rebuild, focus lands on the dialog title (never on <body>)
    $('#compare-title').focus({ preventScroll: true });
    const pairs = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const result = assessJoinByIds(store.select.catalog(), a.id, b.id, pilot.profiles);
      const pa = profileFor(a, pilot.profiles), pb = profileFor(b, pilot.profiles);
      const overlap = pa.countries.filter((c) => pb.countries.includes(c));
      const countryNote = !pa.countries.length || !pb.countries.length ? 'Not recorded for both sources' : overlap.length ? overlap.join(', ') : 'No documented overlap';
      pairs.push(`<section><h3>${esc(a.title)} + ${esc(b.title)}</h3><p><strong class="fit-${result.status}">${esc(result.status)}</strong> · ${result.kit ? esc(result.kit.label) : 'No verified kit'}</p><p>Documented country overlap: ${esc(countryNote)} · Units: ${esc(pa.unit || 'unknown')} / ${esc(pb.unit || 'unknown')}</p><ul>${result.notes.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul><button class="pair-project" data-a="${a.id}" data-b="${b.id}">Add pair to project</button></section>`);
    }
    document.getElementById('compare-compatibility').innerHTML = `<h2>Pair compatibility</h2>${pairs.join('') || '<p>Select two or more datasets to assess compatibility.</p>'}`;
    modal.querySelectorAll('.pair-project').forEach((button) => button.onclick = () => {
      store.actions.setCompareOpen(false); onProject([button.dataset.a, button.dataset.b]);
    });
  }

  store.subscribe(render);
  render();
}
