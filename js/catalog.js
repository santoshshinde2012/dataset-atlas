/**
 * Catalog loading and sanitization.
 *
 * The catalog JSON is third-party-curated data: every entry is validated
 * and normalized here before anything else sees it, so the rest of the app
 * can trust entry shapes (single choke point for input hardening).
 */
import { withProfiles } from './dataset.js';
import { DOMAIN_META, REGION_META, SOURCE_TYPE_META, GLOBAL_REGION } from './config.js';
import { hashId } from './utils/text.js';
import { sanitizeResources, sanitizeLandingPage } from './resource.js';
import { sanitizeCoverageKind } from './coverage.js';
import { knownLicenseUrl } from './license-use.js';

const KAGGLE_REF_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const WEAK_PROVIDER = new Set(['data', 'datos', 'gov', 'hub', 'statistics', 'opendata', 'census', 'population', 'stats', 'sdd', 'datasource']);

function refineProviderId(id, url) {
  const current = typeof id === 'string' ? id : '';
  if (current && !WEAK_PROVIDER.has(current) && PROVIDER_OK.test(current)) return current;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const slug = host.toLowerCase().replace(/[^a-z0-9.]+/g, '').replace(/\./g, '-').replace(/-+/g, '-').slice(0, 40);
    if (PROVIDER_OK.test(slug)) return slug;
  } catch { /* keep the editorial id */ }
  return PROVIDER_OK.test(current) ? current : '';
}

function sanitizeSample(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const columns = Array.isArray(raw.columns)
    ? raw.columns.map((cell) => clean(String(cell)).slice(0, 40)).filter(Boolean).slice(0, 8)
    : [];
  if (columns.length < 2) return null;
  const rows = (Array.isArray(raw.rows) ? raw.rows : []).slice(0, 3).map((row) => (
    Array.isArray(row)
      ? row.slice(0, columns.length).map((cell) => clean(String(cell ?? '')).slice(0, 48))
      : null
  )).filter((row) => row && row.length === columns.length);
  if (!rows.length) return null;
  const source = typeof raw.source === 'string' ? raw.source.trim() : '';
  const sample = { columns, rows };
  if (/^https?:\/\/[^\s\x00-\x1f\x7f"'<>\\`]+$/i.test(source)) sample.source = source;
  return sample;
}

/**
 * Validate and normalize one raw catalog entry.
 * Returns null when the entry is unusable (bad URL scheme, unknown
 * domain/region); otherwise returns a defensively-normalized copy.
 */
/** Strip control characters that could smuggle line breaks into clipboard/shell contexts. */
const clean = (s) => String(s).replace(/[\x00-\x1f\x7f]/g, ' ');
const PROVIDER_OK = /^[a-z0-9][a-z0-9.-]{0,40}$/;

export function sanitizeEntry(d) {
  if (!d || typeof d !== 'object') return null;
  // require a whitespace/control-free http(s) URL end to end — a newline in a
  // copied URL would paste as multiple terminal lines, C0/DEL bytes could
  // smuggle terminal escapes through Copy link or the manifest, and quotes or
  // angle brackets could break out of an href attribute
  const url = typeof d.url === 'string' ? d.url.trim() : '';
  if (!/^https?:\/\/[^\s\x00-\x1f\x7f"'<>\\`]+$/i.test(url)) return null;
  if (!DOMAIN_META[d.domain]) return null;
  if (d.region !== GLOBAL_REGION && !REGION_META[d.region]) return null;
  const e = { ...d };
  e.url = url;
  e.landingPage = sanitizeLandingPage(d.landingPage, url);
  e.title = clean(d.title || 'Untitled dataset');
  e.description = clean(d.description || '');
  e.source = clean(d.source || 'Unknown');
  if (!SOURCE_TYPE_META[e.sourceType]) e.sourceType = 'research';
  e.formats = Array.isArray(d.formats) && d.formats.length ? d.formats.map(clean) : ['Other'];
  e.license = clean(d.license || 'Unknown');
  e.licenseOpenness = Math.max(0, Math.min(1, +d.licenseOpenness || 0));
  e.freshnessYear = +d.freshnessYear || 2015;
  if (!Number.isInteger(d.publicationYear) || d.publicationYear < 1800 || d.publicationYear > new Date().getUTCFullYear()) delete e.publicationYear;
  if (typeof d.isAccessibleForFree !== 'boolean') delete e.isAccessibleForFree;
  if (Number.isInteger(d.sourceModifiedYear) && d.sourceModifiedYear >= 1990 && d.sourceModifiedYear <= new Date().getUTCFullYear()) {
    e.sourceModifiedYear = d.sourceModifiedYear;
  } else delete e.sourceModifiedYear;
  e.coverageStart = +d.coverageStart || e.freshnessYear;
  e.coverageEnd = +d.coverageEnd || e.freshnessYear;
  e.approxSizeMB = Math.max(0.1, +d.approxSizeMB || 1);
  if (!KAGGLE_REF_RE.test(e.kaggleRef || '')) delete e.kaggleRef;
  // optional country tags: ISO 3166-1 alpha-2, uppercase, at most 4
  e.countries = Array.isArray(d.countries)
    ? d.countries.filter((c) => /^[A-Z]{2}$/.test(String(c))).slice(0, 4)
    : [];
  // optional provenance stamp written by the refresh pipeline
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.verified || '')) delete e.verified;
  e.resources = sanitizeResources(d.resources);
  e.coverageKind = sanitizeCoverageKind(e);
  const providerId = refineProviderId(d.providerId, url);
  if (providerId) e.providerId = providerId;
  else delete e.providerId;
  const licenseUrl = typeof d.licenseUrl === 'string' ? d.licenseUrl.trim() : '';
  if (/^https?:\/\/[^\s\x00-\x1f\x7f"'<>\\`]+$/i.test(licenseUrl)) e.licenseUrl = licenseUrl;
  else if (!licenseUrl) {
    const known = knownLicenseUrl(e.license);
    if (known) e.licenseUrl = known;
    else delete e.licenseUrl;
  } else delete e.licenseUrl;
  const sample = sanitizeSample(d.sample);
  if (sample) e.sample = sample;
  else delete e.sample;
  return e;
}

/** Sanitize a raw catalog payload ({datasets: [...]} or a bare array). */
export function buildCatalog(raw) {
  return (raw.datasets || raw)
    .map(sanitizeEntry)
    .filter(Boolean)
    // ids reach data-* attributes and URLs, so only the hashId shape is trusted
    .map((d) => ({ ...d, id: /^d[a-z0-9]+$/.test(d.id || '') ? d.id : hashId(d.url) }));
}

/** Fetch and build the catalog plus map data. Browser-only (uses fetch). */
export async function loadAtlasData(base = '') {
  const [world, countryRegion, countryCodes, rawCatalog, pilot, coverage] = await Promise.all([
    fetch(`${base}data/world-110m.json`).then((r) => r.json()),
    fetch(`${base}data/country-regions.json`).then((r) => r.json()),
    fetch(`${base}data/country-codes.json`).then((r) => r.json()),
    fetch(`${base}data/catalog.json`).then((r) => r.json()),
    fetch(`${base}data/pilot.json`).then((r) => r.json()),
    fetch(`${base}data/country-coverage.json`).then((r) => (r.ok ? r.json() : { series: {} })).catch(() => ({ series: {} })),
  ]);
  return {
    world,
    countryRegion,
    countryCodes, // ISO-numeric id -> { cca2, name }
    catalog: withProfiles(buildCatalog(rawCatalog), pilot.profiles),
    rawCatalog,
    pilot,
    coverage,
    generated: /^\d{4}-\d{2}-\d{2}$/.test(rawCatalog.generated || '') ? rawCatalog.generated : null,
  };
}
