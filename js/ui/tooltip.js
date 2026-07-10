/** Region tooltip: availability summary that follows the pointer. */
import { REGION_META, DOMAIN_META } from '../config.js';
import { esc } from '../utils/text.js';
import { domainCounts } from '../filters.js';
import { icon } from '../icons.js';

export function createTooltip(element, store, countryCodes = {}) {
  function show(event, regionKey, countryId = null) {
    const list = store.select.filtered().filter((d) => d.region === regionKey);
    const chips = Object.entries(domainCounts(list))
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => {
        const m = DOMAIN_META[k];
        return `<span class="tt-domain" style="color:${m.color};border-color:${m.color}55">${icon(m.icon)} ${n}</span>`;
      }).join('');

    const country = countryId ? countryCodes[countryId] : null;
    const countrySpecific = country ? store.select.countryDatasets(country.cca2).length : 0;
    const title = country
      ? `${esc(country.name)} · ${esc(REGION_META[regionKey].name)}`
      : esc(REGION_META[regionKey].name);
    const sub = countrySpecific
      ? `${countrySpecific} specific to ${esc(country.name)} · ${list.length} in region`
      : `${list.length} dataset${list.length === 1 ? ' matches' : 's match'} current filters`;

    element.innerHTML = `
      <div class="tt-title">${title}</div>
      <div class="tt-sub">${sub}</div>
      ${chips ? `<div class="tt-domains">${chips}</div>` : ''}`;
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
