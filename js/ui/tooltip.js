/** Region tooltip: availability summary that follows the pointer. */
import { REGION_META, DOMAIN_META } from '../config.js';
import { esc } from '../utils/text.js';
import { domainCounts } from '../filters.js';

export function createTooltip(element, store) {
  function show(event, regionKey) {
    const list = store.select.filtered().filter((d) => d.region === regionKey);
    const chips = Object.entries(domainCounts(list))
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => {
        const m = DOMAIN_META[k];
        return `<span class="tt-domain" style="color:${m.color};border-color:${m.color}55">${m.icon} ${n}</span>`;
      }).join('');
    element.innerHTML = `
      <div class="tt-title">${esc(REGION_META[regionKey].name)}</div>
      <div class="tt-sub">${list.length} dataset${list.length === 1 ? ' matches' : 's match'} current filters</div>
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
