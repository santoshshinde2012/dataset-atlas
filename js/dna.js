/**
 * Dataset "DNA" scoring (concept B): five normalized 0..1 metrics that let
 * users compare datasets at a glance. Pure functions, unit-tested.
 */
import { CURRENT_YEAR } from './config.js';
import { sizeLabel } from './utils/text.js';

const GRANULARITY_SCORE = { country: 0.3, admin: 0.55, city: 0.75, point: 1, grid: 1 };

const clamp01 = (v, floor = 0.08) =>
  Number.isFinite(v) ? Math.max(floor, Math.min(1, v)) : floor;

/**
 * @returns {{label: string, value: number, tip: string}[]} five bars:
 * freshness, coverage span, granularity, size, license openness.
 */
export function dnaMetrics(d) {
  const span = Math.max(0, (d.coverageEnd || 0) - (d.coverageStart || 0));
  return [
    {
      label: 'FRS',
      value: clamp01((d.freshnessYear - 2008) / (CURRENT_YEAR - 2008)),
      tip: `Freshness — data last updated ${d.freshnessYear}`,
    },
    {
      label: 'COV',
      value: clamp01(Math.log10(span + 1) / Math.log10(150)),
      tip: `Coverage — ${d.coverageStart}–${d.coverageEnd} (${span} yrs)`,
    },
    {
      label: 'GRN',
      value: GRANULARITY_SCORE[d.granularity] || 0.3,
      tip: `Granularity — ${d.granularity || 'country'} level`,
    },
    {
      label: 'SIZ',
      value: clamp01(Math.log10((d.approxSizeMB || 0.5) + 1) / 5),
      tip: `Size — ~${sizeLabel(d.approxSizeMB ?? 0.5)}`,
    },
    {
      label: 'LIC',
      value: clamp01(d.licenseOpenness || 0),
      tip: `License — ${d.license}`,
    },
  ];
}
