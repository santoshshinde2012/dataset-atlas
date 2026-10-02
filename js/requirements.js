/** Shared validation for browser filters, project links, and agent requests. */
export const LEVELS = ['country', 'state', 'district', 'lgd-district', 'county', 'subdivision', 'admin1', 'admin', 'city', 'point', 'grid'];
export function validYear(value) {
  const n = Number(value);
  return value !== null && value !== '' && Number.isInteger(n) && n >= 1800 && n <= 2100 ? n : null;
}
export function practicalFilters(values = {}) {
  return {
    startYear: validYear(values.startYear), endYear: validYear(values.endYear),
    level: LEVELS.includes(values.level) ? values.level : '',
    resourceKind: ['download', 'api'].includes(values.resourceKind) ? values.resourceKind : '',
    country: /^[A-Z]{2}$/.test(values.country || '') ? values.country : '',
    coverageMode: ['candidate', 'documented', 'observed'].includes(values.coverageMode) ? values.coverageMode : 'candidate',
    reuse: ['analysis', 'redistribute'].includes(values.reuse) ? values.reuse : '',
  };
}

/** Optional filter ranges and required project ranges use the same rules. */
export function yearRangeErrors(startValue, endValue, { required = false } = {}) {
  const start = validYear(startValue), end = validYear(endValue);
  const errors = {};
  if ((required || (startValue != null && startValue !== '')) && !start) errors.startYear = 'Enter a whole year from 1800 to 2100.';
  if ((required || (endValue != null && endValue !== '')) && !end) errors.endYear = 'Enter a whole year from 1800 to 2100.';
  if (start && end && start > end) errors.endYear = 'To year must be the same as or later than From year.';
  return errors;
}
