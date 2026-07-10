/**
 * The domain dock: a floating glass bar over the map stage where every
 * domain is ALWAYS visible as an icon + live count. The active (or hovered)
 * chip expands to show its label, so nine domains fit at any width without
 * hiding behind a scroll — the header stays minimal.
 */
import { DOMAIN_META, domainColor, accentColor } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc } from '../utils/text.js';
import { icon } from '../icons.js';

export function initDomainDock({ store }) {
  const dock = $('#domain-dock');

  const mkChip = (key, label, iconName) => {
    const b = el('button', 'dock-chip');
    b.dataset.key = key;
    b.title = label;
    b.innerHTML = `${icon(iconName)}<span class="dock-label">${esc(label)}</span><span class="chip-count"></span>`;
    b.onclick = () => {
      const { domain } = store.getState();
      store.actions.setDomain(domain === key ? 'all' : key);
    };
    dock.appendChild(b);
  };
  mkChip('all', 'All domains', 'layers');
  for (const [key, m] of Object.entries(DOMAIN_META)) mkChip(key, m.name, m.icon);

  function render() {
    const state = store.getState();
    const counts = store.select.domainCounts();
    counts.all = Object.values(counts).reduce((a, b) => a + b, 0);
    for (const b of dock.children) {
      const key = b.dataset.key;
      b.classList.toggle('active', state.domain === key);
      b.style.setProperty('--chip-color',
        key === 'all' ? accentColor(state.theme) : domainColor(key, state.theme));
      b.querySelector('.chip-count').textContent = counts[key] || 0;
      b.setAttribute('aria-label', `${b.title} — ${counts[key] || 0} datasets`);
      b.setAttribute('aria-pressed', state.domain === key ? 'true' : 'false');
    }
  }

  store.subscribe(render);
  render();
}
