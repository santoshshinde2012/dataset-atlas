/** Region tooltip: availability summary that follows the pointer. */
import { REGION_META, DOMAIN_META, domainColor } from '../config.js';
import { esc } from '../utils/text.js';
import { domainCounts } from '../filters.js';
import { icon } from '../icons.js';

export function createTooltip(element, store, countryCodes = {}) {
  function show(event, regionKey, countryId = null) {
    const list = store.select.filtered().filter((d) => d.region === regionKey);
    const theme = store.getState().theme;
    const chips = Object.entries(domainCounts(list))
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => {
        const c = domainColor(k, theme);
        return `<span class="tt-domain" style="color:${c};border-color:${c}55">${icon(DOMAIN_META[k].icon)} ${n}</span>`;
      }).join('');

    const regionName = REGION_META[regionKey].name;
    const country = countryId ? countryCodes[countryId] : null;
    const countrySpecific = country ? store.select.countryDatasets(country.cca2).length : 0;

    // a clear two-level picture: the exact country, then its region
    const stats = country
      ? `<div class="tt-stats">
           <div class="tt-stat"><b>${countrySpecific}</b><span>${esc(country.name)}-specific</span></div>
           <div class="tt-stat"><b>${list.length}</b><span>in ${esc(regionName)}</span></div>
         </div>`
      : `<div class="tt-stats">
           <div class="tt-stat"><b>${list.length}</b><span>dataset${list.length === 1 ? '' : 's'} match filters</span></div>
         </div>`;

    element.innerHTML = `
      <div class="tt-title">${country ? esc(country.name) : esc(regionName)}</div>
      ${country ? `<div class="tt-sub">${esc(regionName)}</div>` : ''}
      ${stats}
      ${chips ? `<div class="tt-domains">${chips}</div>` : ''}
      <div class="tt-hint">${country && countrySpecific
        ? `Click to browse — ${esc(country.name)} first`
        : 'Click to browse datasets'}</div>`;
    element.hidden = false;
    move(event);
  }

  function move(event) {
    if (element.hidden) return;
    const pad = 14;
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    const r = element.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = event.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = event.clientY - r.height - pad;
    element.style.left = x + 'px';
    element.style.top = y + 'px';
  }

  function hide() { element.hidden = true; }

  return { show, move, hide };
}
