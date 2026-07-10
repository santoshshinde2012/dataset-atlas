/**
 * Central registries for the atlas.
 *
 * Everything domain-, region-, source- or preset-specific lives here as
 * data, so extending the atlas (a new domain, a new region, a new use-case
 * preset) is a configuration change — no rendering or filtering code needs
 * to be touched (open/closed principle).
 */

/** `icon` values are keys into the js/icons.js registry (SVG, not emoji). */
export const DOMAIN_META = {
  climate:      { name: 'Climate',      icon: 'climate',      color: '#38bdf8' },
  health:       { name: 'Health',       icon: 'health',       color: '#fb7185' },
  economy:      { name: 'Economy',      icon: 'economy',      color: '#fbbf24' },
  agriculture:  { name: 'Agriculture',  icon: 'agriculture',  color: '#4ade80' },
  education:    { name: 'Education',    icon: 'education',    color: '#a78bfa' },
  transport:    { name: 'Transport',    icon: 'transport',    color: '#fb923c' },
  energy:       { name: 'Energy',       icon: 'energy',       color: '#fde047' },
  demographics: { name: 'Demographics', icon: 'demographics', color: '#e879f9' },
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

/** Choropleth availability ramp — also drives the on-map legend gradient. */
export const AVAIL_RAMP = ['#111f38', '#164860', '#1e7d9c', '#35c3e0'];

/** Fill for countries outside every atlas region (e.g. Antarctica). */
export const NO_REGION_FILL = '#0e1626';

/** Darker accent companion used inside DNA-strip gradients. */
export const ACCENT_DEEP = '#17557a';

/** Reference year for freshness scoring (kept explicit so scoring is deterministic). */
export const CURRENT_YEAR = 2026;
