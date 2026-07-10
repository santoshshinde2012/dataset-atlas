/**
 * Catalog filtering as composable facet predicates.
 *
 * Each facet is an independent predicate over (dataset, filterState); the
 * faceted-count UI works by evaluating all facets except the one being
 * counted. Adding a new facet means adding one predicate here — the
 * matching and counting machinery is closed to modification.
 */
import { REGION_META, GLOBAL_REGION } from './config.js';
import { normFormat } from './utils/text.js';

const haystack = (d) =>
  `${d.title} ${d.description} ${d.source} ${d.domain} ${d.region}`.toLowerCase();

/** @type {Record<string, (d: object, s: object) => boolean>} */
export const FACETS = {
  domain: (d, s) => s.domain === 'all' || d.domain === s.domain,
  source: (d, s) => s.sourceTypes.has(d.sourceType),
  format: (d, s) => (d.formats || []).some((f) => s.formats.has(normFormat(f))),
  license: (d, s) => (d.licenseOpenness ?? 0) >= s.minOpenness,
  search: (d, s) => !s.search || haystack(d).includes(s.search),
  changed: (d, s) => !s.onlyChanged ||
    !s.changes || s.changes.newIds.has(d.id) || s.changes.updatedIds.has(d.id),
};

/**
 * Does a dataset match the current filter state?
 * @param {string[]} [ignore] facet names to skip (for faceted counts)
 */
export function matchesFacets(d, filterState, ignore = []) {
  for (const [name, pred] of Object.entries(FACETS)) {
    if (ignore.includes(name)) continue;
    if (!pred(d, filterState)) return false;
  }
  return true;
}

export const filterCatalog = (catalog, filterState, ignore = []) =>
  catalog.filter((d) => matchesFacets(d, filterState, ignore));

/** Dataset count per region (all real regions plus the global pseudo-region). */
export function regionCounts(list) {
  const counts = { [GLOBAL_REGION]: 0 };
  for (const key of Object.keys(REGION_META)) counts[key] = 0;
  for (const d of list) if (counts[d.region] !== undefined) counts[d.region]++;
  return counts;
}

/** Dataset count per domain. */
export function domainCounts(list) {
  const counts = {};
  for (const d of list) counts[d.domain] = (counts[d.domain] || 0) + 1;
  return counts;
}
