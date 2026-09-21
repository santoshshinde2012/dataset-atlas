/**
 * Verified and documented join kits. Adding a kit is a data change.
 * A `verified` kit has a runnable notebook and checked cardinality.
 * A `documented` kit has an explicit transform but no checked notebook.
 */
export const KITS = [
  {
    id: 'energy-co2',
    status: 'verified',
    task: 'energy',
    label: 'Energy use vs CO₂ (country-year)',
    pair: [
      'https://github.com/owid/energy-data',
      'https://github.com/owid/co2-data',
    ],
    notebook: 'data/energy-co2-example.ipynb',
    joinNote: 'Verified pilot pair: drop aggregate rows without ISO-3, then join on iso_code and year (one-to-one). Energy is TWh; co2 is million tonnes.',
    resultGrain: 'country',
  },
  {
    id: 'india-crop-rainfall',
    status: 'verified',
    task: 'crop',
    label: 'India crop production + rainfall',
    pair: [
      'https://www.kaggle.com/datasets/abhinand05/crop-production-in-india',
      'https://www.data.gov.in/resource/sub-divisional-monthly-rainfall-1901-2017',
    ],
    notebook: 'data/crop-rainfall-example.ipynb',
    crosswalk: 'data/india-district-subdivision.json',
    samples: ['data/samples/india-crop-sample.csv', 'data/samples/india-rainfall-sample.csv'],
    joinNote: 'Verified via IMD subdivision crosswalk: map district→subdivision, aggregate production, sum monthly rainfall to year, join on imd_subdivision + year. Result grain is subdivision, not district. Unmatched districts are dropped.',
    resultGrain: 'subdivision',
  },
  {
    id: 'covid-population',
    status: 'documented',
    task: 'health',
    label: 'COVID-19 cases vs population',
    pair: [
      'https://github.com/owid/covid-19-data/tree/master/public/data',
      'https://data.worldbank.org/indicator/SP.POP.TOTL',
    ],
    joinNote: 'Documented temporal alignment: sum daily new_cases to calendar year, then join World Bank SP.POP.TOTL on ISO-3 / year. Population is a mid-year estimate. No checked notebook yet.',
    resultGrain: 'country',
  },
];

export function kitForPair(urlA, urlB) {
  const pair = new Set([urlA, urlB]);
  return KITS.find((kit) => kit.pair.every((url) => pair.has(url))) || null;
}

export function kitsForTask(taskId) {
  return KITS.filter((kit) => kit.task === taskId);
}
