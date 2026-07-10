/** Compare tray: up to four shortlisted datasets side by side, every column
 * still one click from download or pin. */
import { DOMAIN_META, REGION_META, GLOBAL_REGION, domainColor } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc, sizeLabel } from '../utils/text.js';
import { icon } from '../icons.js';
import { accessRequirement } from '../access.js';

export function initCompare({ store, toast }) {
  const tray = $('#compare-tray');
  const modal = $('#compare-modal');
  const wrap = $('#compare-table-wrap');

  tray.onclick = () => store.actions.setCompareOpen(true);
  $('#compare-close').onclick = () => store.actions.setCompareOpen(false);
  modal.onclick = (e) => { if (e.target === modal) store.actions.setCompareOpen(false); };

  let wasOpen = false;
  let lastKey = null;

  function render() {
    const state = store.getState();
    const items = store.select.compareDatasets();
    tray.hidden = items.length === 0;
    $('#compare-count').textContent = items.length;

    const shouldShow = state.compareOpen && items.length > 0;
    modal.hidden = !shouldShow;
    if (!shouldShow) { wasOpen = false; lastKey = null; return; }

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
        ${row('Coverage', (d) => `${d.coverageStart}–${d.coverageEnd}`)}
        ${row('Updated', (d) => String(d.freshnessYear))}
        ${row('Granularity', (d) => esc(d.granularity))}
        ${row('Size', (d) => `~${sizeLabel(d.approxSizeMB)}`)}
        ${row('Formats', (d) => esc((d.formats || []).join(', ')))}
        ${row('Access', (d) => { const a = accessRequirement(d); return a ? esc(a.label) : 'Open'; })}
      </tbody>
      <tfoot><tr><th></th>${items.map((d) => `
        <td class="compare-actions-cell" data-id="${esc(d.id)}">
          <a class="get-btn" href="${esc(d.url)}" target="_blank" rel="noopener">Get ${icon('external')}</a>
          <button class="compare-remove" title="Remove from comparison" aria-label="Remove ${esc(d.title)}">${icon('close')}</button>
        </td>`).join('')}</tr></tfoot>
    </table>`;

    wrap.querySelectorAll('.compare-remove').forEach((btn) => {
      btn.onclick = () => store.actions.toggleCompare(btn.closest('[data-id]').dataset.id);
    });
    // after any rebuild, focus lands on the dialog title (never on <body>)
    $('#compare-title').focus({ preventScroll: true });
    wasOpen = true;
  }

  store.subscribe(render);
  render();
}
