/** Top bar: domain chips, projection toggle, theme toggle, passport button. */
import { DOMAIN_META, domainColor, accentColor } from '../config.js';
import { $, el } from '../utils/dom.js';
import { esc } from '../utils/text.js';
import { icon } from '../icons.js';

export function initTopbar({ store, onPassportToggle }) {
  const nav = $('#domain-chips');

  // chips are built once; refresh() only updates counts/active state so
  // keyboard focus survives re-renders
  const mkChip = (key, label, iconName) => {
    const b = el('button', 'chip');
    b.dataset.key = key;
    b.innerHTML = `${icon(iconName)} ${esc(label)} <span class="chip-count"></span>`;
    b.onclick = () => {
      const { domain } = store.getState();
      store.actions.setDomain(domain === key ? 'all' : key);
    };
    nav.appendChild(b);
  };
  mkChip('all', 'All domains', 'layers');
  for (const [key, m] of Object.entries(DOMAIN_META)) mkChip(key, m.name, m.icon);

  $('#proj-globe').onclick = () => store.actions.setProjection('globe');
  $('#proj-flat').onclick = () => store.actions.setProjection('flat');
  $('#theme-toggle').onclick = () => store.actions.toggleTheme();
  $('#passport-btn').onclick = onPassportToggle;

  function render() {
    const state = store.getState();
    const counts = store.select.domainCounts();
    counts.all = Object.values(counts).reduce((a, b) => a + b, 0);
    for (const b of nav.children) {
      const key = b.dataset.key;
      b.classList.toggle('active', state.domain === key);
      b.style.setProperty('--chip-color',
        key === 'all' ? accentColor(state.theme) : domainColor(key, state.theme));
      b.querySelector('.chip-count').textContent = counts[key] || 0;
    }
    $('#proj-globe').classList.toggle('active', state.projection === 'globe');
    $('#proj-flat').classList.toggle('active', state.projection === 'flat');
    // the toggle shows the theme you would switch TO
    $('#theme-toggle').innerHTML = icon(state.theme === 'light' ? 'moon' : 'sun');
    $('#theme-toggle').title = state.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    $('#passport-count').textContent = state.pins.size;
    syncChipOverflow();
  }

  // edge fade only when the strip genuinely scrolls, so the last chip is
  // never faded out on wide screens where everything fits
  function syncChipOverflow() {
    nav.classList.toggle('overflowing', nav.scrollWidth > nav.clientWidth + 1);
  }
  addEventListener('resize', syncChipOverflow);

  store.subscribe(render);
  render();
  syncTopbarHeight();
  addEventListener('resize', syncTopbarHeight);
}

/** Expose the real topbar height to CSS (it wraps on narrow screens). */
export function syncTopbarHeight() {
  document.documentElement.style.setProperty('--topbar-h', $('#topbar').offsetHeight + 'px');
}
