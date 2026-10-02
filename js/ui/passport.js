import { setFieldError } from './form-controls.js';
import { passportSummary, passportList, importPassport } from '../passport.js';
import { inventory, inventoryCsv, pythonRecipe } from '../exports.js';
import { downloadText } from '../services/download.js';
/** Data Passport drawer: pinned datasets and manifest export. Open/closed
 * state lives in the store (state.passportOpen) so there is a single owner
 * for right-edge layout decisions. */
import { REGION_META, DOMAIN_META, GLOBAL_REGION, domainColor } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc } from '../utils/text.js';
import { manifestText } from '../manifest.js';
import { bibliographyFor } from '../citation.js';
import { serializeState } from '../url-state.js';
import { icon } from '../icons.js';

export function initPassport({ store, toast, copyText, onDetails, onProject }) {
  const drawer = $('#passport-drawer');
  let query = '', sort = 'saved', undoIds = [];
  const feedback = (message) => { $('#passport-feedback').textContent = message; };
  const remove = (ids) => {
    undoIds = ids;
    ids.length === store.select.pinnedDatasets().length ? store.actions.clearPins() : ids.forEach((id) => store.actions.togglePin(id));
    const box = $('#passport-feedback'); box.textContent = `${ids.length} removed. `;
    const undo = el('button', '', 'Undo'); undo.id = 'passport-undo';
    undo.onclick = () => { const restored = store.actions.importPins(undoIds); undoIds = []; render(); feedback(`${restored} restored.`); $('#passport-close').focus(); };
    box.appendChild(undo); undo.focus({ preventScroll: true });
  };
  $('#passport-search').oninput = (event) => { query = event.target.value; render(); };
  $('#passport-sort').onchange = (event) => { sort = event.target.value; render(); };
  $('#passport-project').onclick = () => { const ids = store.select.pinnedDatasets().map((d) => d.id); if (!ids.length) return; store.actions.closePassport(); onProject(ids); toast(`${ids.length} saved sources added to the current project`); };
  $('#passport-import').onchange = async (event) => {
    const input = event.target, file = input.files[0]; if (!file) return;
    setFieldError(input);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Inventory must be smaller than 2 MB.');
      const result = importPassport(JSON.parse(await file.text()), store.select.catalog());
      const added = store.actions.importPins(result.ids);
      feedback(`${added} added; ${result.ids.length - added} already saved; ${result.skipped} unknown IDs skipped. Imported metadata and resource URLs are not applied.`);
    } catch (error) { const message = error instanceof SyntaxError ? 'Invalid JSON. Choose an exported Atlas inventory.' : error.message; setFieldError(input, message); feedback(message); }
    finally { input.value = ''; }
  };

  $('#passport-close').onclick = () => store.actions.closePassport();
  $('#passport-export').onclick = () => {
    const pinned = store.select.pinnedDatasets();
    if (!pinned.length) return toast('Pin some datasets first');
    downloadText('data-passport.sh', manifestText(pinned), 'text/x-shellscript');
    toast('Manifest exported');
  };
  $('#passport-copy').onclick = () => {
    const pinned = store.select.pinnedDatasets();
    if (!pinned.length) return toast('Pin some datasets first');
    copyText(manifestText(pinned), 'Manifest copied');
    const btn = $('#passport-copy');
    const original = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = `${icon('check')} Copied`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = original;
    }, 1600);
  };
  for (const [id, name, format, type] of [
    ['passport-json', 'atlas-inventory.json', (list) => JSON.stringify(inventory(list, store.getState(), store.getState().resourceSelections), null, 2), 'application/json'],
    ['passport-csv', 'atlas-inventory.csv', (list) => inventoryCsv(list, store.getState(), store.getState().resourceSelections), 'text/csv'],
    ['passport-python', 'atlas-download.py', (list) => pythonRecipe(list, store.getState(), store.getState().resourceSelections), 'text/x-python'],
  ]) document.getElementById(id).onclick = () => {
    const list = store.select.pinnedDatasets(); if (!list.length) return toast('Pin some datasets first');
    downloadText(name, format(list), type);
  };
  $('#passport-clear').onclick = () => remove(store.select.pinnedDatasets().map((d) => d.id));
  $('#passport-bib').onclick = () => {
    const pinned = store.select.pinnedDatasets();
    if (!pinned.length) return toast('Pin some datasets first');
    downloadText('references.bib', bibliographyFor(pinned, new Date().toISOString().slice(0, 10)), 'text/plain');
    toast('references.bib exported');
  };
  $('#passport-share').onclick = () => {
    const pinned = store.select.pinnedDatasets();
    if (!pinned.length) return toast('Pin some datasets first');
    const params = new URLSearchParams(serializeState(store.getState(), store.select.allFormats()));
    params.set('p', pinned.map((d) => d.id).join('.'));
    const url = `${location.origin}${location.pathname}#${params.toString()}`;
    copyText(url, 'Share link copied — pins included');
  };

  let wasOpen = false, renderedKey;
  function render() {
    const open = store.getState().passportOpen;
    const justOpened = open && !wasOpen;
    if (!open && wasOpen && drawer.contains(document.activeElement)) $('#passport-btn').focus({ preventScroll: true });
    wasOpen = open;
    drawer.hidden = !open;
    $('#passport-btn').setAttribute('aria-expanded', String(open));
    if (justOpened) $('#passport-close').focus({ preventScroll: true });

    const pinned = store.select.pinnedDatasets();
    const key = JSON.stringify([pinned.map((d) => d.id), store.getState().theme, query, sort]);
    if (key === renderedKey) return;
    renderedKey = key;
    const stats = passportSummary(pinned);
    drawer.querySelectorAll('.passport-export-grid button, .passport-actions button').forEach((control) => control.disabled = !pinned.length);
    $('#passport-tools').hidden = !pinned.length;
    $('#passport-export-options').hidden = !pinned.length;
    drawer.querySelector('.passport-actions').hidden = !pinned.length;
    $('#passport-sub').textContent = pinned.length ? `${pinned.length} saved source${pinned.length === 1 ? '' : 's'} · ready to review and use` : 'Your portable research collection';
    $('#passport-summary').innerHTML = pinned.length ? `<div class="passport-stats"><span><b>${stats.total}</b>Saved</span><span><b>${stats.regions}</b>Regions</span><span><b>${stats.domains}</b>Domains</span></div><p class="passport-readiness">${stats.files} with file links · ${stats.apis} with APIs · ${stats.sourceOnly} source-page only</p>` : '';
    const box = $('#passport-list');
    const scroll = drawer.querySelector('.passport-body').scrollTop;
    box.innerHTML = '';
    if (!pinned.length) {
      box.innerHTML = `<section class="passport-empty"><span class="passport-empty-icon">${icon('passport')}</span><h3>Build your research collection</h3><p>Save useful datasets across regions. Review sources here, then take them into a project or export a portable inventory.</p><button id="passport-discover" class="primary">Explore global datasets</button><ol><li>Find a source on the map or in search.</li><li>Use its bookmark button to save it.</li><li>Review, share or export your collection here.</li></ol></section>`;
      $('#passport-discover').onclick = () => { store.actions.selectRegion(GLOBAL_REGION); $('#global-pill').focus(); };
      return;
    }
    const visible = passportList(pinned, query, sort);
    if (!visible.length) box.innerHTML = '<p class="empty-note">No saved sources match. Try a different search.</p>';
    const theme = store.getState().theme;
    for (const d of visible) {
      const item = el('article', 'passport-item');
      const dm = DOMAIN_META[d.domain];
      const regionName = d.region === GLOBAL_REGION ? 'Global' : (REGION_META[d.region]?.name || d.region);
      const access = d.resources?.some((r) => r.kind === 'download') ? 'File link recorded' : d.resources?.some((r) => r.kind === 'api') ? 'API recorded' : 'Source-page only';
      item.innerHTML = `<div class="pi-heading"><span class="pi-icon" style="color:${domainColor(d.domain, theme) || 'var(--muted)'}">${icon(dm?.icon || 'file')}</span><span class="pi-sub">${esc(dm?.name || d.domain)} · ${esc(regionName)}</span></div><h3 class="pi-title">${esc(d.title)}</h3><p class="pi-sub">${esc(d.source)}</p><div class="pi-evidence"><span>${esc(access)}</span><span>${esc(d.coverageStart)}–${esc(d.coverageEnd)}</span><span>${esc(d.license || 'License unknown')}</span></div><div class="pi-actions"><a href="${esc(d.landingPage || d.url)}" target="_blank" rel="noopener noreferrer">Open source ${icon('external')}</a><button class="pi-details">Details</button><button class="pi-remove" aria-label="Remove ${esc(d.title)}">${icon('close')}</button></div>`;
      item.querySelector('.pi-details').onclick = () => onDetails(d.id);
      item.querySelector('.pi-remove').onclick = () => remove([d.id]);
      box.appendChild(item);
    }
    drawer.querySelector('.passport-body').scrollTop = scroll;
  }

  store.subscribe(render);
  render();
}
