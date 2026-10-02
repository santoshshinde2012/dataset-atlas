import { seriesObservation } from './coverage.js';
/** Small, deterministic search engine shared by the browser and MCP server. */
const STOP_WORDS = new Set(['a', 'an', 'and', 'data', 'dataset', 'datasets', 'for', 'in', 'of', 'the', 'to', 'with', 'from', 'between', 'through', 'during']);

/** Query words that mean the same topic. Matching any member counts. */
const SYNONYMS = {
  pm25: ['pm25', 'particulate'],
  particulate: ['pm25', 'particulate'],
  aqi: ['aqi'],
  pm2: ['pm25', 'particulate', 'pm2'],
  rainfall: ['rainfall', 'precipitation', 'rain', 'chirps'],
  rain: ['rainfall', 'precipitation', 'rain', 'chirps'],
  precipitation: ['rainfall', 'precipitation', 'rain', 'chirps'],
  chirps: ['rainfall', 'precipitation', 'chirps'],
  enrolment: ['enrolment', 'enrollment'],
  enrollment: ['enrolment', 'enrollment'],
  co2: ['co2', 'carbon'],
  carbon: ['co2', 'carbon'],
};

/** Display names used to interpret country requirements. */
const COUNTRY_NAMES = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AD: 'Andorra', AO: 'Angola', AG: 'Antigua and Barbuda',
  AR: 'Argentina', AM: 'Armenia', AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan', BS: 'Bahamas',
  BH: 'Bahrain', BD: 'Bangladesh', BB: 'Barbados', BY: 'Belarus', BE: 'Belgium', BZ: 'Belize',
  BJ: 'Benin', BT: 'Bhutan', BO: 'Bolivia', BA: 'Bosnia and Herzegovina', BW: 'Botswana', BR: 'Brazil',
  BN: 'Brunei', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi', KH: 'Cambodia', CM: 'Cameroon',
  CA: 'Canada', CV: 'Cape Verde', CF: 'Central African Republic', TD: 'Chad', CL: 'Chile', CN: 'China',
  CO: 'Colombia', KM: 'Comoros', CG: 'Republic of the Congo', CD: 'DR Congo', CR: 'Costa Rica',
  CI: 'Ivory Coast', HR: 'Croatia', CU: 'Cuba', CY: 'Cyprus', CZ: 'Czechia', DK: 'Denmark',
  DJ: 'Djibouti', DM: 'Dominica', DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt', SV: 'El Salvador',
  GQ: 'Equatorial Guinea', ER: 'Eritrea', EE: 'Estonia', SZ: 'Eswatini', ET: 'Ethiopia', FJ: 'Fiji',
  FI: 'Finland', FR: 'France', GA: 'Gabon', GM: 'Gambia', GE: 'Georgia', DE: 'Germany', GH: 'Ghana',
  GR: 'Greece', GD: 'Grenada', GT: 'Guatemala', GN: 'Guinea', GW: 'Guinea-Bissau', GY: 'Guyana',
  HT: 'Haiti', HN: 'Honduras', HU: 'Hungary', IS: 'Iceland', IN: 'India', ID: 'Indonesia', IR: 'Iran',
  IQ: 'Iraq', IE: 'Ireland', IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan',
  KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati', KW: 'Kuwait', KG: 'Kyrgyzstan', LA: 'Laos',
  LV: 'Latvia', LB: 'Lebanon', LS: 'Lesotho', LR: 'Liberia', LY: 'Libya', LI: 'Liechtenstein',
  LT: 'Lithuania', LU: 'Luxembourg', MG: 'Madagascar', MW: 'Malawi', MY: 'Malaysia', MV: 'Maldives',
  ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands', MR: 'Mauritania', MU: 'Mauritius', MX: 'Mexico',
  FM: 'Micronesia', MD: 'Moldova', MC: 'Monaco', MN: 'Mongolia', ME: 'Montenegro', MA: 'Morocco',
  MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru', NP: 'Nepal', NL: 'Netherlands',
  NZ: 'New Zealand', NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria', MK: 'North Macedonia', NO: 'Norway',
  OM: 'Oman', PK: 'Pakistan', PW: 'Palau', PA: 'Panama', PG: 'Papua New Guinea', PY: 'Paraguay',
  PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania', RU: 'Russia',
  RW: 'Rwanda', KN: 'Saint Kitts and Nevis', LC: 'Saint Lucia', VC: 'Saint Vincent and the Grenadines',
  WS: 'Samoa', SM: 'San Marino', ST: 'Sao Tome and Principe', SA: 'Saudi Arabia', SN: 'Senegal',
  RS: 'Serbia', SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapore', SK: 'Slovakia', SI: 'Slovenia',
  SB: 'Solomon Islands', SO: 'Somalia', ZA: 'South Africa', SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka',
  SD: 'Sudan', SR: 'Suriname', SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan',
  TZ: 'Tanzania', TH: 'Thailand', TL: 'Timor-Leste', TG: 'Togo', TO: 'Tonga', TT: 'Trinidad and Tobago',
  TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan', TV: 'Tuvalu', UG: 'Uganda', UA: 'Ukraine',
  AE: 'United Arab Emirates', GB: 'United Kingdom', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
  VU: 'Vanuatu', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
};

const ALIASES = { US: ['usa', 'america'], GB: ['uk', 'britain', 'british'], AE: ['uae'], KR: ['korea'], KP: ['korea'] };

export const COUNTRY_OPTIONS = { ...COUNTRY_NAMES, KR: 'South Korea', KP: 'North Korea' };

function normalizeText(value) {
  return String(value || '')
    .replace(/pm\s*2\s*\.?\s*5/gi, ' pm25 ')
    .replace(/co₂/gi, ' co2 ')
    .replace(/gross domestic product/gi, ' gross domestic product gdp ')
    .replace(/carbon dioxide/gi, ' carbon dioxide co2 ');
}

function words(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z0-9]+/g) || [];
}

function canonical(word) {
  if (word === 'cities') return 'city';
  if (word === 'indian') return 'india';
  if (word === 'emissions') return 'emission';
  return word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function alts(term) {
  return SYNONYMS[term] || [term];
}

export function queryTerms(query) {
  return [...new Set(words(parseQuery(query).text).map(canonical).filter((word) => !STOP_WORDS.has(word)))];
}

function contains(set, term, prefix) {
  for (const alt of alts(term)) {
    if (set.has(alt)) return true;
    if (prefix && alt.length >= 3 && [...set].some((word) => word.startsWith(alt))) return true;
  }
  return false;
}

/** Zero means no match. Positive scores reward titles over descriptive text. */
export function searchScore(dataset, query, { includeFacets = true, coverageIndex = null } = {}) {
  const parsed = parseQuery(query);
  if (parsed.startYear && (dataset.coverageEnd < parsed.startYear || dataset.coverageStart > parsed.endYear)) return 0;
  if (parsed.country) {
    const span = seriesObservation(coverageIndex, dataset, parsed.country);
    if (span === 'absent') return 0;
    if (span && parsed.startYear && (span.end < parsed.startYear || span.start > parsed.endYear)) return 0;
  }
  const terms = queryTerms(query);
  if (!terms.length) return parsed.level ? (dataset.granularity === parsed.level || (dataset.reviewedProfiles || []).some((p) => p.level === parsed.level) || words(`${dataset.title} ${dataset.description}`).includes(parsed.level) ? 1 : 0) : parsed.startYear ? 1 : 0;
  const title = new Set(words(dataset.title).map(canonical));
  const description = new Set(words(dataset.description).map(canonical));
  const source = new Set(words(dataset.source).map(canonical));
  const facets = includeFacets ? new Set(words(`${dataset.domain} ${dataset.region}`).map(canonical)) : new Set();
  const tagged = new Set(dataset.countries || []);
  const metadata = new Set(words(dataset.searchMetadata || '').map(canonical));
  const otherTerms = terms.filter((term) => term !== parsed.country?.toLowerCase());

  let score = 0;
  for (const [index, term] of otherTerms.entries()) {
    const prefix = index === otherTerms.length - 1;
    if (contains(title, term, prefix)) score += 5;
    else if (contains(description, term, prefix)) score += 2;
    else if (contains(metadata, term, prefix)) score += 3;
    else if (contains(source, term, prefix)) score += 1;
    else if (contains(facets, term, prefix)) score += 1;
    else return 0;
  }

  if (!parsed.country) return score || (parsed.level ? 1 : 0);
  const isoTerm = parsed.country.toLowerCase();
  const nameTerms = words(COUNTRY_OPTIONS[parsed.country]).map(canonical).filter((w) => !STOP_WORDS.has(w));
  const mentionsCountry = (tokens) => contains(tokens, isoTerm, false)
    || nameTerms.every((term) => tokens.has(term))
    || (ALIASES[parsed.country] || []).some((alias) => tokens.has(canonical(alias)));
  if (mentionsCountry(title)) return score + 5;
  if (tagged.has(parsed.country)) return score + 4;
  if (mentionsCountry(description) || mentionsCountry(source)) return score + 2;
  if (dataset.coverageKind === 'global-country-series') return score + 1;
  return 0;
}

/** Interpret country phrases and year ranges without guessing unknown columns. */
const queryCache = new Map();
export function parseQuery(query) {
  const key = String(query || '').slice(0, 200);
  if (queryCache.has(key)) return queryCache.get(key);
  let text = String(query || '').slice(0, 200).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const years = [...text.matchAll(/\b(18\d{2}|19\d{2}|20\d{2}|2100)\b/g)].map((m) => Number(m[1]));
  text = text.replace(/\b(18\d{2}|19\d{2}|20\d{2}|2100)\b/g, ' ');
  let country = null;
  const names = Object.entries(COUNTRY_OPTIONS).flatMap(([iso, name]) => [
    [iso, name.toLowerCase()], ...((ALIASES[iso] || []).map((a) => [iso, a])), ...(new RegExp(`\\b${iso}\\b`).test(String(query)) ? [[iso, iso.toLowerCase()]] : []),
  ]).sort((a, b) => b[1].length - a[1].length);
  for (const [iso, name] of names) {
    const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const re = new RegExp(`\\b${normalized}\\b`, 'i');
    if (re.test(text)) { country = iso; text = text.replace(re, ' '); break; }
  }
  const level = /\b(country|state|district|county|subdivision|admin1|city|point|grid)\b/.exec(text)?.[1] || null;
  if (level) text = text.replace(new RegExp(`\\b${level}\\b`, 'g'), ' ');
  if (country) text += ` ${country.toLowerCase()}`;
  const parsed = Object.freeze({ text, country, level, startYear: years.length ? Math.min(...years) : null, endYear: years.length ? Math.max(...years) : null });
  if (queryCache.size >= 32) queryCache.delete(queryCache.keys().next().value);
  queryCache.set(key, parsed);
  return parsed;
}

export function searchExplanation(dataset, query, coverageIndex = null) {
  const parsed = parseQuery(query);
  const reasons = [];
  if (parsed.country) {
    const span = seriesObservation(coverageIndex, dataset, parsed.country);
    reasons.push(span && span !== 'absent' ? `${parsed.country}: observed rows ${span.start}–${span.end}`
      : (dataset.countries || []).includes(parsed.country) ? `${parsed.country}: documented country tag`
      : dataset.coverageKind === 'global-country-series' ? `${parsed.country}: global series candidate; confirm coverage` : 'Country named in source text');
  }
  if (parsed.level) {
    const levels = [dataset.granularity, ...(dataset.reviewedProfiles || []).map((p) => p.level)].filter(Boolean);
    reasons.push(levels.includes(parsed.level) ? `Requested geography: ${parsed.level}` : `Requested ${parsed.level}; source ${[...new Set(levels)].join('/') || 'unknown'} — review alignment`);
  }
  if (parsed.startYear) reasons.push(`Overlaps requested ${parsed.startYear}–${parsed.endYear}; gaps may exist`);
  const meta = new Set(words(dataset.searchMetadata || '').map(canonical));
  if (queryTerms(query).some((t) => contains(meta, t, false))) reasons.push('Matches reviewed variables or columns');
  if (!reasons.length) reasons.push('Matches title or descriptive metadata');
  return reasons;
}
