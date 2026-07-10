/**
 * Shareable URL state: the current view serialized into location.hash so
 * any filtered map, focused country, or pinned collection is addressable —
 * bookmarkable, citable, sendable — with no backend. Pure serialize/parse;
 * the browser wiring lives in main.js.
 *
 * Params: d=domain r=region c=focusCountry q=search o=minOpenness
 *         st=sourceTypes f=formats srt=sort v=projection p=pin ids (share only)
 */
import { DOMAIN_META, REGION_META, SOURCE_TYPE_META, GLOBAL_REGION } from './config.js';

export const SORTS = ['freshness', 'coverage', 'openness', 'size', 'title'];

/** @returns {string} hash fragment (without '#'), '' when everything is default */
export function serializeState(state, allFormats) {
  const p = new URLSearchParams();
  if (state.domain !== 'all') p.set('d', state.domain);
  if (state.region) p.set('r', state.region);
  if (state.focusCountry) p.set('c', state.focusCountry);
  if (state.search) p.set('q', state.search);
  if (state.minOpenness > 0) p.set('o', String(state.minOpenness));
  if (state.sourceTypes.size < Object.keys(SOURCE_TYPE_META).length) {
    p.set('st', [...state.sourceTypes].sort().join('.'));
  }
  if (allFormats && state.formats.size < allFormats.length) {
    p.set('f', [...state.formats].sort().join('.'));
  }
  if (state.sort && state.sort !== 'freshness') p.set('srt', state.sort);
  if (state.projection !== 'globe') p.set('v', state.projection);
  return p.toString();
}

/** @returns {object} sanitized partial state parsed from a hash fragment */
export function parseState(hash) {
  const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const out = {};
  const d = p.get('d');
  if (d && DOMAIN_META[d]) out.domain = d;
  const r = p.get('r');
  if (r && (REGION_META[r] || r === GLOBAL_REGION)) out.region = r;
  const c = p.get('c');
  if (c && /^[A-Z]{2}$/.test(c)) out.focusCountry = c;
  const q = p.get('q');
  if (q) out.search = q.slice(0, 80);
  const o = parseFloat(p.get('o'));
  if (!Number.isNaN(o) && o > 0 && o <= 1) out.minOpenness = o;
  const st = p.get('st');
  if (st) {
    const keys = st.split('.').filter((k) => SOURCE_TYPE_META[k]);
    if (keys.length) out.sourceTypes = keys;
  }
  const f = p.get('f');
  if (f) {
    const list = f.split('.').filter((x) => /^[A-Za-z]{1,10}$/.test(x));
    if (list.length) out.formats = list; // an empty list would clear every format
  }
  const srt = p.get('srt');
  if (srt && SORTS.includes(srt)) out.sort = srt;
  if (p.get('v') === 'flat') out.projection = 'flat';
  const pins = p.get('p');
  if (pins) {
    const list = pins.split('.').filter((id) => /^d[a-z0-9]+$/.test(id)).slice(0, 100);
    if (list.length) out.pins = list;
  }
  return out;
}
