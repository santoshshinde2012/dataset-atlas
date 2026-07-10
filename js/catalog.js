/**
 * Catalog loading and sanitization.
 *
 * The catalog JSON is third-party-curated data: every entry is validated
 * and normalized here before anything else sees it, so the rest of the app
 * can trust entry shapes (single choke point for input hardening).
 */
import { DOMAIN_META, REGION_META, SOURCE_TYPE_META, GLOBAL_REGION } from './config.js';
import { hashId } from './utils/text.js';

const KAGGLE_REF_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/**
 * Validate and normalize one raw catalog entry.
 * Returns null when the entry is unusable (bad URL scheme, unknown
 * domain/region); otherwise returns a defensively-normalized copy.
 */
/** Strip control characters that could smuggle line breaks into clipboard/shell contexts. */
const clean = (s) => String(s).replace(/[\x00-\x1f\x7f]/g, ' ');

export function sanitizeEntry(d) {
  if (!d || typeof d !== 'object') return null;
  // require a whitespace/control-free http(s) URL end to end — a newline in a
  // copied URL would paste as multiple terminal lines
  const url = typeof d.url === 'string' ? d.url.trim() : '';
  if (!/^https?:\/\/\S+$/i.test(url)) return null;
  if (!DOMAIN_META[d.domain]) return null;
  if (d.region !== GLOBAL_REGION && !REGION_META[d.region]) return null;
  const e = { ...d };
  e.url = url;
  e.title = clean(d.title || 'Untitled dataset');
  e.description = clean(d.description || '');
  e.source = clean(d.source || 'Unknown');
  if (!SOURCE_TYPE_META[e.sourceType]) e.sourceType = 'research';
  e.formats = Array.isArray(d.formats) && d.formats.length ? d.formats.map(clean) : ['Other'];
  e.license = clean(d.license || 'Unknown');
  e.licenseOpenness = Math.max(0, Math.min(1, +d.licenseOpenness || 0));
  e.freshnessYear = +d.freshnessYear || 2015;
  e.coverageStart = +d.coverageStart || e.freshnessYear;
  e.coverageEnd = +d.coverageEnd || e.freshnessYear;
  e.approxSizeMB = Math.max(0.1, +d.approxSizeMB || 1);
  if (!KAGGLE_REF_RE.test(e.kaggleRef || '')) delete e.kaggleRef;
  return e;
}

/** Sanitize a raw catalog payload ({datasets: [...]} or a bare array). */
export function buildCatalog(raw) {
  return (raw.datasets || raw)
    .map(sanitizeEntry)
    .filter(Boolean)
    .map((d) => ({ ...d, id: d.id || hashId(d.url) }));
}

/** Fetch and build the catalog plus map data. Browser-only (uses fetch). */
export async function loadAtlasData(base = '') {
  const [world, countryRegion, rawCatalog] = await Promise.all([
    fetch(`${base}data/world-110m.json`).then((r) => r.json()),
    fetch(`${base}data/country-regions.json`).then((r) => r.json()),
    fetch(`${base}data/catalog.json`).then((r) => r.json()),
  ]);
  return { world, countryRegion, catalog: buildCatalog(rawCatalog) };
}
