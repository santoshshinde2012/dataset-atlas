/**
 * Geographic coverage. Tagged countries are evidence; a global country-year
 * series is a candidate, not a claim that every country is present.
 */
export const COVERAGE_KINDS = ['tagged-countries', 'global-country-series', 'regional', 'unknown'];

const SERIES_HINT = /world bank|our world in data|owid|fao|who|oecd|un desa|eurostat/i;

export function inferCoverageKind(d) {
  if (Array.isArray(d.countries) && d.countries.length) return 'tagged-countries';
  if (COVERAGE_KINDS.includes(d.coverageKind)) return d.coverageKind;
  const grain = d.granularity || 'country';
  const countryGrain = grain === 'country' || grain === 'admin';
  const hinted = SERIES_HINT.test(`${d.source || ''} ${d.url || ''}`);
  if (d.region === 'global' && countryGrain && hinted) return 'global-country-series';
  if (d.region && d.region !== 'global') return 'regional';
  return 'unknown';
}

export function sanitizeCoverageKind(d) {
  const kind = d.coverageKind;
  if (COVERAGE_KINDS.includes(kind)) return kind;
  return inferCoverageKind(d);
}

/**
 * @returns {'tagged'|'series'|null}
 * tagged = listed on the entry; series = global country-year candidate.
 */
export function countryCoverage(d, cca2) {
  if (!cca2) return null;
  const iso = String(cca2).toUpperCase();
  if ((d.countries || []).includes(iso)) return 'tagged';
  if ((d.coverageKind || inferCoverageKind(d)) === 'global-country-series') return 'series';
  return null;
}

export function coverageLabel(kind) {
  if (kind === 'tagged') return 'This country is tagged on the entry';
  if (kind === 'series') return 'Global country-year series — this country is a candidate, not a verified row';
  return 'Country coverage is unknown';
}
