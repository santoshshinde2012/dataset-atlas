/**
 * Verified and documented join kits. Adding a kit is a data change.
 * A `verified` kit has a runnable notebook and checked cardinality.
 * A `documented` kit has an explicit transform but no checked notebook.
 * `outcome: 'do-not-join'` is a checked incompatibility — agents must not join.
 */
export const KITS = [
  {
    id: 'energy-co2',
    status: 'verified',
    outcome: 'join',
    task: 'energy',
    label: 'Energy use vs CO₂ (country-year)',
    pair: [
      'https://github.com/owid/energy-data',
      'https://github.com/owid/co2-data',
    ],
    notebook: 'data/energy-co2-example.ipynb',
    samples: ['data/samples/owid-energy-sample.csv', 'data/samples/owid-co2-sample.csv'],
    joinNote: 'Verified pilot pair: drop aggregate rows without ISO-3 (and WLD / OWID_WRL), then join on iso_code and year (one-to-one). Energy is TWh; co2 is million tonnes.',
    resultGrain: 'country',
    triggers: ['energy', 'co2', 'emissions', 'carbon', 'owid', 'iso'],
    doNot: [
      'Do not keep OWID_WRL, continent, or World Bank region rows',
      'Do not join on country names when iso_code exists',
    ],
    agentGuidance: 'Use this kit for national energy vs emissions. Drop aggregates first. Result grain is country-year.',
  },
  {
    id: 'india-crop-rainfall',
    status: 'verified',
    outcome: 'join',
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
    triggers: ['crop', 'rainfall', 'india', 'imd', 'district', 'agriculture', 'monsoon'],
    doNot: [
      'Do not join crop and rainfall on district name',
      'Do not treat the result as district-level',
      'Do not invent unmatched districts',
    ],
    agentGuidance: 'Call get_crosswalk with kit india-crop-rainfall plus state and district. Result grain is IMD subdivision.',
  },
  {
    id: 'covid-population',
    status: 'verified',
    outcome: 'join',
    task: 'health',
    label: 'COVID-19 cases vs population',
    pair: [
      'https://github.com/owid/covid-19-data/tree/master/public/data',
      'https://data.worldbank.org/indicator/SP.POP.TOTL',
    ],
    notebook: 'data/covid-population-example.ipynb',
    samples: ['data/samples/covid-cases-sample.csv', 'data/samples/wb-population-sample.csv'],
    joinNote: 'Verified temporal alignment: sum daily new_cases to calendar year, drop aggregates (OWID_WRL, WLD, SAS), then join World Bank SP.POP.TOTL on ISO-3 / year. Population is a mid-year estimate.',
    resultGrain: 'country',
    triggers: ['covid', 'coronavirus', 'population', 'cases', 'deaths', 'who', 'pandemic'],
    doNot: [
      'Do not join a daily case row to annual population',
      'Do not keep World / OWID_WRL / World Bank region totals',
    ],
    agentGuidance: 'Aggregate cases to year, drop aggregates via check_identifiers, then join on ISO-3 + year.',
  },
  {
    id: 'openaq-national-pm25',
    status: 'verified',
    outcome: 'do-not-join',
    task: 'air',
    label: 'OpenAQ stations vs national PM2.5',
    pair: [
      'https://openaq.org',
      'https://data.worldbank.org/indicator/EN.ATM.PM25.MC.M3',
    ],
    notebook: 'data/openaq-station-example.ipynb',
    samples: ['data/samples/openaq-pune-sample.csv'],
    joinNote: 'Do not join. OpenAQ is station-hour point data; World Bank EN.ATM.PM25.MC.M3 is a national annual population-weighted mean. Intra-city AQI can differ more than 5×. Keep station grain; report min/median/max, never a single city AQI.',
    resultGrain: 'station',
    triggers: ['air', 'aqi', 'pm2.5', 'pm25', 'openaq', 'pollution', 'station', 'pune'],
    doNot: [
      'Do not average stations to a city or national AQI',
      'Do not join OpenAQ hours to World Bank annual PM2.5 as the same grain',
    ],
    agentGuidance: 'Refuse a city-average join. Show station spread. National PM2.5 is a different dataset, not a rollup of these stations.',
  },
  {
    id: 'nga-pcode-population',
    status: 'verified',
    outcome: 'join',
    task: 'humanitarian',
    label: 'Nigeria COD-AB + COD-PS (P-codes)',
    pair: [
      'https://data.humdata.org/dataset/cod-ab-nga',
      'https://data.humdata.org/dataset/cod-ps-nga',
    ],
    notebook: 'data/nga-pcode-example.ipynb',
    crosswalk: 'data/nga-pcode-admin1.json',
    samples: ['data/samples/nga-cod-ab-sample.csv', 'data/samples/nga-cod-ps-sample.csv'],
    joinNote: 'Verified on admin-1 P-code (not state name). Inner-join COD-AB to COD-PS on adm1_pcode. Name-only joins fail on spelling variants. Result grain is admin1 (state).',
    resultGrain: 'admin1',
    triggers: ['nigeria', 'hdx', 'pcode', 'p-code', 'humanitarian', 'cod', 'displacement', 'admin'],
    doNot: [
      'Do not join on state names (Lagos vs Lagos State)',
      'Do not mix admin1 P-codes with admin2 P-codes',
    ],
    agentGuidance: 'Join only on adm1_pcode. Call get_crosswalk with kit nga-pcode-population and a P-code. Result grain is Nigerian state (admin1).',
  },
];

export function kitForPair(urlA, urlB) {
  const pair = new Set([urlA, urlB]);
  return KITS.find((kit) => kit.pair.every((url) => pair.has(url))) || null;
}

export function kitsForTask(taskId) {
  return KITS.filter((kit) => kit.task === taskId);
}

export function kitById(id) {
  return KITS.find((kit) => kit.id === id) || null;
}

/**
 * Rank kits for a natural-language question. Empty means: do not invent a join.
 */
export function recommendKits({ query = '', task = '' } = {}) {
  const text = `${query} ${task}`.toLowerCase();
  const ranked = KITS.map((kit) => {
    const hits = (kit.triggers || []).filter((word) => text.includes(word.toLowerCase()));
    const taskHit = task && kit.task === task ? 3 : 0;
    return { kit, score: hits.length + taskHit, hits };
  }).filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.kit.id.localeCompare(b.kit.id));
  return {
    query: query || null,
    task: task || null,
    kits: ranked.map(({ kit, score, hits }) => ({
      id: kit.id,
      status: kit.status,
      outcome: kit.outcome,
      label: kit.label,
      resultGrain: kit.resultGrain,
      joinNote: kit.joinNote,
      doNot: kit.doNot,
      agentGuidance: kit.agentGuidance,
      notebook: kit.notebook || null,
      score,
      matched: hits,
    })),
    guidance: ranked.length
      ? 'Use a listed kit. Follow doNot. A do-not-join outcome is a refusal, not a maybe.'
      : 'No verified kit for this question. Do not invent a join from column names. search_catalog then assess_join; unknown stays unknown.',
  };
}

export function publicKit(kit) {
  return {
    id: kit.id,
    status: kit.status,
    outcome: kit.outcome,
    task: kit.task,
    label: kit.label,
    joinNote: kit.joinNote,
    resultGrain: kit.resultGrain,
    notebook: kit.notebook || null,
    crosswalk: kit.crosswalk || null,
    samples: kit.samples || [],
    doNot: kit.doNot || [],
    agentGuidance: kit.agentGuidance || '',
  };
}
