/**
 * Country identifiers vs silent aggregates.
 *
 * Single responsibility: classify ISO-2 / ISO-3 / OWID / World Bank codes.
 * Country-year joins must drop aggregates (WLD, EUU, OWID_WRL, "World").
 * Unknown stays unknown — this module never guesses a country from a name.
 */
const ISO2_TO_3 = {
  AD: 'AND', AE: 'ARE', AF: 'AFG', AG: 'ATG', AI: 'AIA', AL: 'ALB', AM: 'ARM', AO: 'AGO',
  AQ: 'ATA', AR: 'ARG', AS: 'ASM', AT: 'AUT', AU: 'AUS', AW: 'ABW', AX: 'ALA', AZ: 'AZE',
  BA: 'BIH', BB: 'BRB', BD: 'BGD', BE: 'BEL', BF: 'BFA', BG: 'BGR', BH: 'BHR', BI: 'BDI',
  BJ: 'BEN', BL: 'BLM', BM: 'BMU', BN: 'BRN', BO: 'BOL', BQ: 'BES', BR: 'BRA', BS: 'BHS',
  BT: 'BTN', BV: 'BVT', BW: 'BWA', BY: 'BLR', BZ: 'BLZ', CA: 'CAN', CC: 'CCK', CD: 'COD',
  CF: 'CAF', CG: 'COG', CH: 'CHE', CI: 'CIV', CK: 'COK', CL: 'CHL', CM: 'CMR', CN: 'CHN',
  CO: 'COL', CR: 'CRI', CU: 'CUB', CV: 'CPV', CW: 'CUW', CX: 'CXR', CY: 'CYP', CZ: 'CZE',
  DE: 'DEU', DJ: 'DJI', DK: 'DNK', DM: 'DMA', DO: 'DOM', DZ: 'DZA', EC: 'ECU', EE: 'EST',
  EG: 'EGY', EH: 'ESH', ER: 'ERI', ES: 'ESP', ET: 'ETH', FI: 'FIN', FJ: 'FJI', FK: 'FLK',
  FM: 'FSM', FO: 'FRO', FR: 'FRA', GA: 'GAB', GB: 'GBR', GD: 'GRD', GE: 'GEO', GF: 'GUF',
  GG: 'GGY', GH: 'GHA', GI: 'GIB', GL: 'GRL', GM: 'GMB', GN: 'GIN', GP: 'GLP', GQ: 'GNQ',
  GR: 'GRC', GS: 'SGS', GT: 'GTM', GU: 'GUM', GW: 'GNB', GY: 'GUY', HK: 'HKG', HM: 'HMD',
  HN: 'HND', HR: 'HRV', HT: 'HTI', HU: 'HUN', ID: 'IDN', IE: 'IRL', IL: 'ISR', IM: 'IMN',
  IN: 'IND', IO: 'IOT', IQ: 'IRQ', IR: 'IRN', IS: 'ISL', IT: 'ITA', JE: 'JEY', JM: 'JAM',
  JO: 'JOR', JP: 'JPN', KE: 'KEN', KG: 'KGZ', KH: 'KHM', KI: 'KIR', KM: 'COM', KN: 'KNA',
  KP: 'PRK', KR: 'KOR', KW: 'KWT', KY: 'CYM', KZ: 'KAZ', LA: 'LAO', LB: 'LBN', LC: 'LCA',
  LI: 'LIE', LK: 'LKA', LR: 'LBR', LS: 'LSO', LT: 'LTU', LU: 'LUX', LV: 'LVA', LY: 'LBY',
  MA: 'MAR', MC: 'MCO', MD: 'MDA', ME: 'MNE', MF: 'MAF', MG: 'MDG', MH: 'MHL', MK: 'MKD',
  ML: 'MLI', MM: 'MMR', MN: 'MNG', MO: 'MAC', MP: 'MNP', MQ: 'MTQ', MR: 'MRT', MS: 'MSR',
  MT: 'MLT', MU: 'MUS', MV: 'MDV', MW: 'MWI', MX: 'MEX', MY: 'MYS', MZ: 'MOZ', NA: 'NAM',
  NC: 'NCL', NE: 'NER', NF: 'NFK', NG: 'NGA', NI: 'NIC', NL: 'NLD', NO: 'NOR', NP: 'NPL',
  NR: 'NRU', NU: 'NIU', NZ: 'NZL', OM: 'OMN', PA: 'PAN', PE: 'PER', PF: 'PYF', PG: 'PNG',
  PH: 'PHL', PK: 'PAK', PL: 'POL', PM: 'SPM', PN: 'PCN', PR: 'PRI', PS: 'PSE', PT: 'PRT',
  PW: 'PLW', PY: 'PRY', QA: 'QAT', RE: 'REU', RO: 'ROU', RS: 'SRB', RU: 'RUS', RW: 'RWA',
  SA: 'SAU', SB: 'SLB', SC: 'SYC', SD: 'SDN', SE: 'SWE', SG: 'SGP', SH: 'SHN', SI: 'SVN',
  SJ: 'SJM', SK: 'SVK', SL: 'SLE', SM: 'SMR', SN: 'SEN', SO: 'SOM', SR: 'SUR', SS: 'SSD',
  ST: 'STP', SV: 'SLV', SX: 'SXM', SY: 'SYR', SZ: 'SWZ', TC: 'TCA', TD: 'TCD', TF: 'ATF',
  TG: 'TGO', TH: 'THA', TJ: 'TJK', TK: 'TKL', TL: 'TLS', TM: 'TKM', TN: 'TUN', TO: 'TON',
  TR: 'TUR', TT: 'TTO', TV: 'TUV', TW: 'TWN', TZ: 'TZA', UA: 'UKR', UG: 'UGA', UM: 'UMI',
  US: 'USA', UY: 'URY', UZ: 'UZB', VA: 'VAT', VC: 'VCT', VE: 'VEN', VG: 'VGB', VI: 'VIR',
  VN: 'VNM', VU: 'VUT', WF: 'WLF', WS: 'WSM', XK: 'XKX', YE: 'YEM', YT: 'MYT', ZA: 'ZAF',
  ZM: 'ZMB', ZW: 'ZWE',
};

const ISO3_TO_2 = Object.fromEntries(Object.entries(ISO2_TO_3).map(([a, b]) => [b, a]));

/** World Bank / DAC 3-letter region and income aggregates — not countries. */
const WB_AGGREGATES = {
  WLD: 'World Bank world total',
  EUU: 'European Union',
  EMU: 'Euro area',
  ECS: 'Europe and Central Asia',
  ECA: 'Europe and Central Asia (excluding high income)',
  EAS: 'East Asia and Pacific',
  EAP: 'East Asia and Pacific (excluding high income)',
  SAS: 'South Asia',
  SSF: 'Sub-Saharan Africa',
  SSA: 'Sub-Saharan Africa (excluding high income)',
  LCN: 'Latin America and Caribbean',
  LAC: 'Latin America and Caribbean (excluding high income)',
  MEA: 'Middle East and North Africa',
  MNA: 'Middle East and North Africa (excluding high income)',
  NAC: 'North America',
  HIC: 'High income',
  LIC: 'Low income',
  LMC: 'Lower middle income',
  UMC: 'Upper middle income',
  MIC: 'Middle income',
  OED: 'OECD members',
  ARB: 'Arab world',
  CSS: 'Caribbean small states',
  PSS: 'Pacific island small states',
  OSS: 'Other small states',
  SST: 'Small states',
  LDC: 'Least developed countries',
  FCS: 'Fragile and conflict affected',
  IDX: 'IDA only',
  IDA: 'IDA total',
  IBT: 'IDA and IBRD total',
  IBD: 'IBRD only',
  PRE: 'Pre-demographic dividend',
  PST: 'Post-demographic dividend',
  LTE: 'Late-demographic dividend',
  EAR: 'Early-demographic dividend',
  TEA: 'East Asia and Pacific (IDA and IBRD)',
  TEC: 'Europe and Central Asia (IDA and IBRD)',
  TLA: 'Latin America (IDA and IBRD)',
  TMN: 'Middle East and North Africa (IDA and IBRD)',
  TSA: 'South Asia (IDA and IBRD)',
  TSS: 'Sub-Saharan Africa (IDA and IBRD)',
  AFE: 'Africa Eastern and Southern',
  AFW: 'Africa Western and Central',
  CEB: 'Central Europe and the Baltics',
  HPC: 'Heavily indebted poor countries',
};

const OWID_AGGREGATES = {
  OWID_WRL: 'OWID world total',
  OWID_EUR: 'OWID Europe',
  OWID_AFR: 'OWID Africa',
  OWID_ASI: 'OWID Asia',
  OWID_NAM: 'OWID North America',
  OWID_SAM: 'OWID South America',
  OWID_OCE: 'OWID Oceania',
  OWID_EUN: 'OWID European Union',
  OWID_CIS: 'OWID CIS',
  OWID_INT: 'OWID international transport',
};

const NAME_AGGREGATES = new Set([
  'world', 'africa', 'asia', 'europe', 'european union', 'european union (27)',
  'north america', 'south america', 'oceania', 'high-income countries',
  'low-income countries', 'upper-middle-income countries', 'lower-middle-income countries',
]);

const norm = (value) => String(value || '').trim().toUpperCase();

export function iso3For(code) {
  const raw = String(code || '').trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return ISO2_TO_3[raw.toUpperCase()] || null;
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  return null;
}

export function iso2For(code) {
  const raw = String(code || '').trim().toUpperCase();
  if (ISO2_TO_3[raw]) return raw;
  return ISO3_TO_2[raw] || null;
}

export function isWbAggregate(code) {
  return Boolean(WB_AGGREGATES[norm(code)]);
}

export function isOwidAggregate(code) {
  const raw = norm(code);
  if (OWID_AGGREGATES[raw]) return true;
  return raw.startsWith('OWID_') && raw !== 'OWID_KOS';
}

export function isNameAggregate(name) {
  return NAME_AGGREGATES.has(String(name || '').trim().toLowerCase());
}

export function isAggregate(code, name = '') {
  return isWbAggregate(code) || isOwidAggregate(code) || isNameAggregate(name);
}

/** True when the value is an ISO-3 country, not a region or income group. */
export function isCountryIso3(code) {
  const iso3 = iso3For(code);
  if (!iso3 || !/^[A-Z]{3}$/.test(iso3)) return false;
  if (WB_AGGREGATES[iso3] || OWID_AGGREGATES[iso3]) return false;
  return Boolean(ISO3_TO_2[iso3]);
}

/**
 * Classify one identifier for agents. Drop aggregates before any country-year join.
 * @returns {{input: string, status: 'country'|'aggregate'|'unknown', drop: boolean, iso2?: string, iso3?: string, kind: string, reason: string}}
 */
export function classifyIdentifier(value) {
  const input = String(value || '').trim();
  if (!input) {
    return { input, status: 'unknown', drop: false, kind: 'empty', reason: 'No identifier supplied' };
  }
  if (isNameAggregate(input)) {
    return { input, status: 'aggregate', drop: true, kind: 'name', reason: `"${input}" is a region or world total, not a country` };
  }
  const upper = input.toUpperCase();
  if (OWID_AGGREGATES[upper] || (upper.startsWith('OWID_') && upper !== 'OWID_KOS')) {
    return {
      input, status: 'aggregate', drop: true, kind: 'owid',
      reason: OWID_AGGREGATES[upper] || 'OWID aggregate entity — drop before joining',
    };
  }
  if (WB_AGGREGATES[upper]) {
    return { input, status: 'aggregate', drop: true, kind: 'world-bank', iso3: upper, reason: WB_AGGREGATES[upper] };
  }
  if (/^[A-Z]{2}$/.test(upper) && ISO2_TO_3[upper]) {
    return {
      input, status: 'country', drop: false, kind: 'iso2', iso2: upper, iso3: ISO2_TO_3[upper],
      reason: `ISO 3166-1 alpha-2 country ${upper} (${ISO2_TO_3[upper]})`,
    };
  }
  if (/^[A-Z]{3}$/.test(upper) && ISO3_TO_2[upper]) {
    return {
      input, status: 'country', drop: false, kind: 'iso3', iso3: upper, iso2: ISO3_TO_2[upper],
      reason: `ISO 3166-1 alpha-3 country ${upper}`,
    };
  }
  return { input, status: 'unknown', drop: false, kind: 'unknown', reason: 'Not a known ISO country or listed aggregate — inspect the source codebook' };
}

export function classifyIdentifiers(values) {
  return (Array.isArray(values) ? values : [values]).map(classifyIdentifier);
}

/** Keep rows whose iso field is a country. Aggregates and blanks are dropped. */
export function dropAggregateRows(rows, isoField = 'iso_code', nameField = 'country') {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => {
    const classified = classifyIdentifier(row?.[isoField] || '');
    if (classified.status === 'country') return true;
    if (classified.status === 'aggregate') return false;
    return !isNameAggregate(row?.[nameField]);
  });
}

export const IDENTIFIER_NOTE = 'Drop World Bank aggregates (WLD, EUU, SAS, …) and OWID entities (OWID_WRL, continents) before any country-year join. Do not join on country names when ISO-3 exists.';
