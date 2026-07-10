/**
 * Central registries for the atlas.
 *
 * Everything domain-, region-, source- or preset-specific lives here as
 * data, so extending the atlas (a new domain, a new region, a new use-case
 * preset) is a configuration change — no rendering or filtering code needs
 * to be touched (open/closed principle).
 */

export const DOMAIN_META = {
  climate:      { name: 'Climate',      icon: '🌦', color: '#38bdf8' },
  health:       { name: 'Health',       icon: '🩺', color: '#fb7185' },
  economy:      { name: 'Economy',      icon: '💹', color: '#fbbf24' },
  agriculture:  { name: 'Agriculture',  icon: '🌾', color: '#4ade80' },
  education:    { name: 'Education',    icon: '🎓', color: '#a78bfa' },
  transport:    { name: 'Transport',    icon: '🚆', color: '#fb923c' },
  energy:       { name: 'Energy',       icon: '⚡', color: '#fde047' },
  demographics: { name: 'Demographics', icon: '👥', color: '#e879f9' },
};

export const REGION_META = {
  'north-america': { name: 'North America', centroid: [-100, 43] },
  'latin-america': { name: 'Latin America', centroid: [-62, -14] },
  'europe':        { name: 'Europe',        centroid: [14, 50] },
  'africa':        { name: 'Africa',        centroid: [21, 3] },
  'asia':          { name: 'Asia',          centroid: [88, 34] },
  'oceania':       { name: 'Oceania',       centroid: [140, -26] },
};

/** The pseudo-region for datasets covering the whole world. */
export const GLOBAL_REGION = 'global';

export const SOURCE_TYPE_META = {
  kaggle:       { name: 'Kaggle',            color: '#20beff' },
  'intl-org':   { name: 'International org', color: '#4ade80' },
  'gov-portal': { name: 'Gov portal',        color: '#fbbf24' },
  research:     { name: 'Research',          color: '#a78bfa' },
  ngo:          { name: 'NGO',               color: '#fb7185' },
};

export const PRESETS = [
  { label: 'Forecast crop yields',      sub: 'agriculture data',       domain: 'agriculture' },
  { label: 'Study disease outbreaks',   sub: 'health & epidemiology',  domain: 'health' },
  { label: 'Model climate risk',        sub: 'climate & environment',  domain: 'climate' },
  { label: 'Build an economic model',   sub: 'macro & finance series', domain: 'economy' },
  { label: 'Analyze energy transition', sub: 'power & emissions',      domain: 'energy' },
];

export const LICENSE_LABELS = {
  '0': 'any', '0.2': 'terms ok', '0.4': 'free w/ signup',
  '0.6': 'share-alike+', '0.8': 'CC BY+', '1': 'CC0 / PD',
};

/** Display order for normalized format facets. */
export const FORMAT_ORDER = ['CSV', 'API', 'JSON', 'XLSX', 'Raster', 'Geo', 'Other'];

export const ACCENT_COLOR = '#38e1ff';

/** Reference year for freshness scoring (kept explicit so scoring is deterministic). */
export const CURRENT_YEAR = 2026;
