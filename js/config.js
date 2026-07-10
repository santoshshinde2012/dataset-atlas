/**
 * Central registries for the atlas.
 *
 * Everything domain-, region-, source- or preset-specific lives here as
 * data, so extending the atlas (a new domain, a new region, a new use-case
 * preset) is a configuration change — no rendering or filtering code needs
 * to be touched (open/closed principle).
 */

/** `icon` values are keys into the js/icons.js registry (SVG, not emoji).
 * Domain colors live in THEMES (they differ per surface); use domainColor(). */
export const DOMAIN_META = {
  climate:      { name: 'Climate',      icon: 'climate' },
  health:       { name: 'Health',       icon: 'health' },
  economy:      { name: 'Economy',      icon: 'economy' },
  agriculture:  { name: 'Agriculture',  icon: 'agriculture' },
  education:    { name: 'Education',    icon: 'education' },
  transport:    { name: 'Transport',    icon: 'transport' },
  energy:       { name: 'Energy',       icon: 'energy' },
  demographics: { name: 'Demographics', icon: 'demographics' },
};

export const REGION_META = {
  'north-america': { name: 'North America', centroid: [-100, 43] },
  'latin-america': { name: 'Latin America', centroid: [-62, -14] },
  'europe':        { name: 'Europe',        centroid: [14, 50] },
  'africa':        { name: 'Africa',        centroid: [21, 3] },
  'middle-east':   { name: 'Middle East',   centroid: [45, 27] },
  'asia':          { name: 'Asia',          centroid: [95, 33] },
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

/** Use-case presets (concept C). Each carries a starter BUNDLE — 5 curated
 * catalog URLs that one click pins into the Data Passport, ready to export.
 * Bundle URLs are validated against the catalog by `npm run validate`. */
export const PRESETS = [
  {
    label: 'Forecast crop yields', sub: 'agriculture data', domain: 'agriculture',
    bundle: [
      'https://www.fao.org/faostat/en/#data/QCL',
      'https://ourworldindata.org/crop-yields',
      'https://catalog.data.gov/dataset/quick-stats-agricultural-database',
      'https://www.data.gov.in/catalog/district-wise-season-wise-crop-production-statistics-0',
      'https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset',
    ],
  },
  {
    label: 'Study disease outbreaks', sub: 'health & epidemiology', domain: 'health',
    bundle: [
      'https://github.com/owid/covid-19-data/tree/master/public/data',
      'https://www.who.int/data/gho',
      'https://www.kaggle.com/datasets/lydia70/malaria-in-africa',
      'https://www.kaggle.com/datasets/sudalairajkumar/covid19-in-india',
      'https://www.kaggle.com/datasets/kumarajarshi/life-expectancy-who',
    ],
  },
  {
    label: 'Model climate risk', sub: 'climate & environment', domain: 'climate',
    bundle: [
      'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels-monthly-means?tab=overview',
      'https://registry.opendata.aws/nex-gddp-cmip6/',
      'https://github.com/owid/co2-data',
      'https://www.ncei.noaa.gov/stormevents/',
      'https://registry.opendata.aws/deafrica-chirps/',
    ],
  },
  {
    label: 'Build an economic model', sub: 'macro & finance series', domain: 'economy',
    bundle: [
      'https://datacatalog.worldbank.org/search/dataset/0037712/World-Development-Indicators',
      'https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/maddison-project-database-2023',
      'https://www.kaggle.com/datasets/sazidthe1/global-inflation-data',
      'https://ec.europa.eu/eurostat/web/products-datasets/-/prc_hicp_minr',
      'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=ZQ',
    ],
  },
  {
    label: 'Analyze energy transition', sub: 'power & emissions', domain: 'energy',
    bundle: [
      'https://github.com/owid/energy-data',
      'https://data.open-power-system-data.org/time_series/',
      'https://datasets.wri.org/dataset/globalpowerplantdatabase',
      'https://www.eia.gov/electricity/data/eia923/',
      'https://www.mbie.govt.nz/building-and-energy/energy-and-natural-resources/energy-statistics-and-modelling/energy-statistics/electricity-statistics',
    ],
  },
];

export const LICENSE_LABELS = {
  '0': 'any', '0.2': 'terms ok', '0.4': 'free w/ signup',
  '0.6': 'share-alike+', '0.8': 'CC BY+', '1': 'CC0 / PD',
};

/** Display order for normalized format facets. */
export const FORMAT_ORDER = ['CSV', 'API', 'JSON', 'XLSX', 'Raster', 'Geo', 'Other'];

/**
 * Theme registry. Both palettes are validated with the data-viz six-checks
 * validator against the actual panel surfaces (light: worst adjacent CVD
 * ΔE 21.2; dark: 9.7 with icon+label secondary encoding everywhere).
 * Sequential ramps are single-hue with monotonic lightness — the step
 * nearest the surface means "near zero".
 */
export const THEMES = {
  light: {
    accent: '#0e7490',
    accentRgb: '14, 116, 144',
    accentDeep: '#164e63',
    availRamp: ['#e3f3f7', '#a3d6e2', '#4da2bb', '#0e6076'],
    noRegionFill: '#e5eaf0',
    metaThemeColor: '#f3f7fa',
    domains: {
      climate: '#2a78d6', health: '#e34948', economy: '#1baf7a', agriculture: '#008300',
      education: '#4a3aa7', transport: '#eb6834', energy: '#eda100', demographics: '#e87ba4',
    },
  },
  dark: {
    accent: '#38e1ff',
    accentRgb: '56, 225, 255',
    accentDeep: '#17557a',
    availRamp: ['#111f38', '#164860', '#1e7d9c', '#35c3e0'],
    noRegionFill: '#0e1626',
    metaThemeColor: '#070b14',
    domains: {
      climate: '#3987e5', health: '#e66767', economy: '#199e70', agriculture: '#008300',
      education: '#9085e9', transport: '#d95926', energy: '#c98500', demographics: '#d55181',
    },
  },
};

export const DEFAULT_THEME = 'light';

/** Resolve a domain's color for the active theme. */
export const domainColor = (key, theme = DEFAULT_THEME) =>
  (THEMES[theme] || THEMES[DEFAULT_THEME]).domains[key];

/** Resolve the accent for the active theme. */
export const accentColor = (theme = DEFAULT_THEME) =>
  (THEMES[theme] || THEMES[DEFAULT_THEME]).accent;

/** Reference year for freshness scoring (kept explicit so scoring is deterministic). */
export const CURRENT_YEAR = 2026;
