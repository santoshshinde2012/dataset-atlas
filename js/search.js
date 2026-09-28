/** Small, deterministic search engine shared by the browser and MCP server. */
const STOP_WORDS = new Set(['a', 'an', 'and', 'data', 'dataset', 'datasets', 'for', 'in', 'of', 'the', 'to', 'with']);

/** Query words that mean the same topic. Matching any member counts. */
const SYNONYMS = {
  pm25: ['pm25', 'particulate', 'aqi'],
  particulate: ['pm25', 'particulate', 'aqi'],
  aqi: ['pm25', 'particulate', 'aqi'],
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

const GENERIC_PLACE = new Set([
  'united', 'state', 'republic', 'island', 'islands', 'south', 'north', 'new', 'saint',
  'democratic', 'people', 'kingdom', 'arab', 'federal', 'islamic', 'land', 'lands',
  'part', 'coast', 'central',
]);

/** Display names for tagged countries. Tokens shorter than 4 and generic words are ignored. */
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

let placeIndex;
function places() {
  if (placeIndex) return placeIndex;
  const tokenToIso = new Map();
  const isoToTokens = new Map();
  const add = (iso, token) => {
    if (!token || token.length < 4 || GENERIC_PLACE.has(token) || STOP_WORDS.has(token)) return;
    if (!isoToTokens.has(iso)) isoToTokens.set(iso, new Set());
    isoToTokens.get(iso).add(token);
    if (!tokenToIso.has(token)) tokenToIso.set(token, new Set());
    tokenToIso.get(token).add(iso);
  };
  for (const [iso, name] of Object.entries(COUNTRY_NAMES)) {
    for (const token of words(name).map(canonical)) add(iso, token);
  }
  for (const [iso, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) add(iso, canonical(alias));
  }
  placeIndex = { tokenToIso, isoToTokens };
  return placeIndex;
}

export function queryTerms(query) {
  return [...new Set(words(String(query).slice(0, 80)).map(canonical).filter((word) => !STOP_WORDS.has(word)))];
}

function contains(set, term, prefix) {
  for (const alt of alts(term)) {
    if (set.has(alt)) return true;
    if (prefix && alt.length >= 3 && [...set].some((word) => word.startsWith(alt))) return true;
  }
  return false;
}

/** Zero means no match. Positive scores reward titles over descriptive text. */
export function searchScore(dataset, query, { includeFacets = true } = {}) {
  const terms = queryTerms(query);
  if (!terms.length) return 0;
  const { tokenToIso, isoToTokens } = places();
  const title = new Set(words(dataset.title).map(canonical));
  const description = new Set(words(dataset.description).map(canonical));
  const source = new Set(words(dataset.source).map(canonical));
  const facets = includeFacets ? new Set(words(`${dataset.domain} ${dataset.region}`).map(canonical)) : new Set();
  const tagged = new Set(dataset.countries || []);
  const countryTerms = [];
  const otherTerms = [];
  for (const term of terms) (tokenToIso.has(term) ? countryTerms : otherTerms).push(term);

  let score = 0;
  for (const [index, term] of otherTerms.entries()) {
    const prefix = index === otherTerms.length - 1;
    if (contains(title, term, prefix)) score += 5;
    else if (contains(description, term, prefix)) score += 2;
    else if (contains(source, term, prefix)) score += 1;
    else if (contains(facets, term, prefix)) score += 1;
    else return 0;
  }

  if (!countryTerms.length) return score;
  let countryScore = 0;
  for (const term of countryTerms) {
    const isos = tokenToIso.get(term) || new Set();
    const taggedHit = [...isos].some((iso) => tagged.has(iso));
    if (contains(title, term, false)) countryScore += 5;
    else if (taggedHit) countryScore += 4;
    else if (contains(description, term, false) || contains(source, term, false)) countryScore += 2;
    else if (dataset.coverageKind === 'global-country-series' && otherTerms.length && score > 0) countryScore += 1;
    else return 0;
  }
  return score + countryScore;
}
