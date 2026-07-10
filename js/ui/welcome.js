/** First-visit orientation card: three steps and a guided CTA, shown once. */
import { $, el } from '../utils/dom.js';
import { icon } from '../icons.js';

const FLAG = 'atlas-welcomed';

export function initWelcome({ store }) {
  let seen = false;
  try { seen = localStorage.getItem(FLAG) === '1'; } catch { /* session-only */ }
  // a shared deep link is its own orientation — don't stack a card on it
  if (seen || location.hash.length > 1) return;

  const card = $('#welcome-card');
  card.innerHTML = `
    <h2>Find datasets in 3 clicks</h2>
    <ol class="welcome-steps">
      <li>${icon('globe')} <div><b>Pick a region</b><span>click a glowing node — or any single country</span></div></li>
      <li>${icon('layers')} <div><b>Pick a domain</b><span>the dock above recolors the whole map</span></div></li>
      <li>${icon('download')} <div><b>Get the data</b><span>deep link or one-click Kaggle command</span></div></li>
    </ol>
    <div class="welcome-actions">
      <button class="primary" id="welcome-try">${icon('search')} Try it: India's datasets</button>
      <button id="welcome-skip">Explore on my own</button>
    </div>`;
  card.hidden = false;

  // any real interaction with the app dismisses the card too; the listener
  // is only removed once the card is actually dismissed, so a tap on the
  // card's own text can never disarm the outside-click behavior
  const bail = (e) => {
    if (!card.hidden && !card.contains(e.target)) dismiss();
  };
  const dismiss = () => {
    card.hidden = true;
    try { localStorage.setItem(FLAG, '1'); } catch { /* session-only */ }
    removeEventListener('pointerdown', bail, true);
  };
  $('#welcome-skip').onclick = dismiss;
  $('#welcome-try').onclick = () => {
    dismiss();
    store.actions.selectRegion('asia', 'IN');
  };
  addEventListener('pointerdown', bail, true);
}
