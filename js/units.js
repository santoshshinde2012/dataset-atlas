/**
 * Unit families. Same ISO-3 + year is not enough if the quantities differ.
 * This module classifies; it never converts. Unknown stays unknown.
 * Longer labels win so "per capita" is a rate, not people, and
 * "million tonnes" is mass rather than a bare "tonne".
 */
const FAMILIES = [
  { id: 'energy', labels: ['twh', 'terawatt', 'exajoule', 'ej', 'kwh', 'mwh', 'gwh', 'joule'] },
  { id: 'mass', labels: ['million tonnes', 'million tons', 'mt co2', 'gt', 'kilotonne', 'tonne', 'metric ton'] },
  { id: 'people', labels: ['population', 'persons', 'inhabitants', 'capita', 'people'] },
  { id: 'currency-current', labels: ['current us$', 'current usd', 'current us dollar', 'nominal usd', 'current lcu'] },
  { id: 'currency-ppp', labels: ['ppp', 'international $', 'international dollar', 'constant 2017', 'constant 2021', 'int$'] },
  { id: 'count', labels: ['cases', 'deaths', 'count of', 'number of'] },
  { id: 'rate', labels: ['per capita', 'per-capita', 'per 100k', 'per 100000', 'percent', '% of'] },
  { id: 'precipitation', labels: ['rainfall', 'precip', 'mm/year', 'millimetre', 'millimeter'] },
  { id: 'temperature', labels: ['celsius', 'fahrenheit', 'kelvin', '°c', 'degc'] },
];

export const UNIT_NOTE = 'Do not add, ratio, or treat columns as the same quantity unless they share a unit family. TWh is not million tonnes. Current US$ is not PPP. A verified kit may still join different quantities as separate columns.';

function norm(value) {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function classifyUnit(value) {
  const text = norm(value);
  if (!text) return { input: value || '', status: 'unknown', family: null, reason: 'No unit given' };
  let best = null;
  for (const family of FAMILIES) {
    for (const label of family.labels) {
      const needle = norm(label);
      if (text.includes(needle) && (!best || needle.length > best.label.length)) {
        best = { family: family.id, label: needle };
      }
    }
  }
  if (best) {
    return { input: value, status: 'known', family: best.family, reason: `Unit family ${best.family}` };
  }
  return { input: value, status: 'unknown', family: null, reason: 'Unit not in the atlas list — confirm in the codebook' };
}

export function compareUnits(a, b) {
  const left = classifyUnit(a);
  const right = classifyUnit(b);
  if (left.status === 'unknown' || right.status === 'unknown') {
    return { status: 'unknown', left, right, reason: 'One or both units are unknown. Do not invent a conversion.' };
  }
  if (left.family === right.family) {
    return { status: 'match', left, right, reason: `Both are ${left.family}` };
  }
  return {
    status: 'conflict',
    left,
    right,
    reason: `${left.family} vs ${right.family}. Do not treat them as the same quantity.`,
  };
}
