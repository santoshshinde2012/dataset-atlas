/** Top bar: domain chips, projection toggle, passport button. */
import { DOMAIN_META, ACCENT_COLOR } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc } from '../utils/text.js';
import { icon } from '../icons.js';

export function initTopbar({ store, onPassportToggle }) {
  const nav = $('#domain-chips');

  // chips are built once; refresh() only updates counts/active state so
  // keyboard focus survives re-renders
  const mkChip = (key, label, iconName, color) => {
    const b = el('button', 'chip');
    b.dataset.key = key;
    b.style.setProperty('--chip-color', color);
    b.innerHTML = `${icon(iconName)} ${esc(label)} <span class="chip-count"></span>`;
    b.onclick = () => {
      const { domain } = store.getState();
      store.actions.setDomain(domain === key ? 'all' : key);
    };
    nav.appendChild(b);
  };
  mkChip('all', 'All domains', 'layers', ACCENT_COLOR);
  for (const [key, m] of Object.entries(DOMAIN_META)) mkChip(key, m.name, m.icon, m.color);

  $('#proj-globe').onclick = () => store.actions.setProjection('globe');
  $('#proj-flat').onclick = () => store.actions.setProjection('flat');
  $('#passport-btn').onclick = onPassportToggle;

  function render() {
    const state = store.getState();
    const counts = store.select.domainCounts();
    counts.all = Object.values(counts).reduce((a, b) => a + b, 0);
    for (const b of nav.children) {
      b.classList.toggle('active', state.domain === b.dataset.key);
      b.querySelector('.chip-count').textContent = counts[b.dataset.key] || 0;
    }
    $('#proj-globe').classList.toggle('active', state.projection === 'globe');
    $('#proj-flat').classList.toggle('active', state.projection === 'flat');
    $('#passport-count').textContent = state.pins.size;
  }

  store.subscribe(render);
  render();
  syncTopbarHeight();
  addEventListener('resize', syncTopbarHeight);
}

/** Expose the real topbar height to CSS (it wraps on narrow screens). */
export function syncTopbarHeight() {
  document.documentElement.style.setProperty('--topbar-h', $('#topbar').offsetHeight + 'px');
}
