/** Top bar: brand, projection toggle, theme toggle, passport button.
 * (Domain selection lives in the floating dock — js/ui/domain-dock.js.) */
import { $ } from '../utils/dom.js';
import { icon } from '../icons.js';

export function initTopbar({ store, onPassportToggle }) {
  $('#proj-globe').onclick = () => store.actions.setProjection('globe');
  $('#proj-flat').onclick = () => store.actions.setProjection('flat');
  $('#theme-toggle').onclick = () => store.actions.toggleTheme();
  $('#passport-btn').onclick = onPassportToggle;

  function render() {
    const state = store.getState();
    $('#proj-globe').classList.toggle('active', state.projection === 'globe');
    $('#proj-flat').classList.toggle('active', state.projection === 'flat');
    // the toggle shows the theme you would switch TO
    $('#theme-toggle').innerHTML = icon(state.theme === 'light' ? 'moon' : 'sun');
    $('#theme-toggle').title = state.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
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
