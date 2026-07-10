/** Data Passport drawer: pinned datasets and manifest export. Open/closed
 * state lives in the store (state.passportOpen) so there is a single owner
 * for right-edge layout decisions. */
import { REGION_META, DOMAIN_META, GLOBAL_REGION } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc } from '../utils/text.js';
import { manifestText } from '../manifest.js';

export function initPassport({ store, toast, copyText }) {
  const drawer = $('#passport-drawer');

  $('#passport-close').onclick = () => store.actions.closePassport();
  $('#passport-export').onclick = () => {
    const pinned = store.select.pinnedDatasets();
    if (!pinned.length) return toast('Pin some datasets first');
    const blob = new Blob([manifestText(pinned)], { type: 'text/x-shellscript' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data-passport.sh';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Manifest exported');
  };
  $('#passport-copy').onclick = () => {
    const pinned = store.select.pinnedDatasets();
    if (!pinned.length) return toast('Pin some datasets first');
    copyText(manifestText(pinned), 'Manifest copied');
  };
  $('#passport-clear').onclick = () => store.actions.clearPins();

  function render() {
    drawer.hidden = !store.getState().passportOpen;

    const pinned = store.select.pinnedDatasets();
    $('#passport-sub').textContent = pinned.length
      ? `${pinned.length} pinned dataset${pinned.length === 1 ? '' : 's'} — export one manifest.`
      : 'Pin datasets across regions, export one manifest.';

    const box = $('#passport-list');
    box.innerHTML = '';
    if (!pinned.length) {
      box.appendChild(el('p', 'empty-note', 'Nothing pinned yet.<br>Use 📌 on any dataset card.'));
      return;
    }
    for (const d of pinned) {
      const item = el('div', 'passport-item');
      const regionName = d.region === GLOBAL_REGION ? 'Global' : (REGION_META[d.region]?.name || d.region);
      item.innerHTML = `
        <span>${DOMAIN_META[d.domain]?.icon || '📄'}</span>
        <div class="pi-meta">
          <div class="pi-title">${esc(d.title)}</div>
          <div class="pi-sub">${esc(d.source)} · ${esc(regionName)}</div>
        </div>`;
      const rm = el('button', '', '×');
      rm.title = 'Remove';
      rm.onclick = () => store.actions.togglePin(d.id);
      item.appendChild(rm);
      box.appendChild(item);
    }
  }

  store.subscribe(render);
  render();
}
