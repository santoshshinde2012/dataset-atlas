/**
 * Inline SVG icon registry — consistent 24×24 stroke icons (Feather-style
 * geometry) so the UI reads as one designed system instead of mixed emoji.
 * Pure string builders: Node-importable, no DOM required.
 */

const PATHS = {
  // brand / regions
  map: '<polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/>',

  // domains
  climate: '<path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.3 2A4 4 0 0 0 7 19z"/>',
  health: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  economy: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  agriculture: '<path d="M12 21c-5-4-7-8-5-13 2.5-4 8-5 12-3.5.8 4.5-.5 10-7 16.5z"/><path d="M12 21c0-6 2-10 6-14"/>',
  education: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12.5V17c3.5 2.5 8.5 2.5 12 0v-4.5"/>',
  transport: '<rect x="5" y="3" width="14" height="13" rx="2"/><line x1="5" y1="11" x2="19" y2="11"/><circle cx="9" cy="18.5" r="1.5"/><circle cx="15" cy="18.5" r="1.5"/><path d="M7 21l-1 1M17 21l1 1"/>',
  energy: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  demographics: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',

  // actions & chrome
  passport: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="10.5" r="2"/><path d="M5.5 15.5c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8"/><line x1="14" y1="9" x2="18.5" y2="9"/><line x1="14" y1="13" x2="18.5" y2="13"/>',
  pin: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
};

/**
 * @param {keyof typeof PATHS} name
 * @param {string} [cls] extra class(es) on the <svg>
 * @returns {string} inline SVG markup (aria-hidden decorative)
 */
export function icon(name, cls = '') {
  const paths = PATHS[name] || PATHS.file;
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);
