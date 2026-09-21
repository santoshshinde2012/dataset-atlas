/**
 * Time basis and population vintage. ISO-3 + "2022" can still be a different year.
 * Unknown stays unknown. This module never shifts dates.
 *
 * World Bank WDI rule: fiscal years ending before 30 June are stored in the
 * first calendar year of the fiscal period; those ending on/after 30 June
 * are stored in the second calendar year (e.g. Australia 2022 = FY 2021–22).
 */
const FY_REPORTERS = {
  AUS: { endMonth: 6, label: 'Australia FY ends 30 June — WDI year is the FY end year' },
  NZL: { endMonth: 6, label: 'New Zealand FY ends 30 June — WDI year is the FY end year' },
  BGD: { endMonth: 6, label: 'Bangladesh FY ends 30 June' },
  PAK: { endMonth: 6, label: 'Pakistan FY ends 30 June' },
  IND: { endMonth: 3, label: 'India FY ends 31 March — WDI year is the FY start year' },
  JPN: { endMonth: 3, label: 'Japan FY ends 31 March' },
  ZAF: { endMonth: 3, label: 'South Africa FY ends 31 March' },
  GBR: { endMonth: 3, label: 'United Kingdom FY ends 31 March' },
  CAN: { endMonth: 3, label: 'Canada FY ends 31 March' },
  USA: { endMonth: 9, label: 'US federal FY ends 30 September — WDI year is the FY end year' },
};

const BASES = {
  calendar: 'calendar',
  fiscal: 'fiscal',
  'mid-year': 'mid-year',
  'census-night': 'census-night',
  '1-january': '1-january',
};

export const VINTAGE_NOTE = 'A year label is not a date. Fiscal-year GDP is not calendar-year emissions. World Bank population is a mid-year estimate and is not OWID population. Census 2011 codes are not current LGD codes.';

export function fiscalReporter(iso3) {
  const code = String(iso3 || '').toUpperCase();
  return FY_REPORTERS[code] || null;
}

export function classifyVintage({ basis, iso3, series } = {}) {
  const key = String(basis || '').toLowerCase().trim();
  const known = BASES[key] || null;
  const fy = fiscalReporter(iso3);
  if (!known && !series) {
    return { status: 'unknown', basis: null, iso3: iso3 || null, reason: 'No time basis given' };
  }
  if (known === 'fiscal' || /fiscal|fy\b/.test(String(series || '').toLowerCase())) {
    return {
      status: 'fiscal',
      basis: 'fiscal',
      iso3: iso3 || null,
      reporter: fy,
      reason: fy ? fy.label : 'Fiscal-year series; confirm the WDI year assignment',
    };
  }
  if (known === 'mid-year' || /mid-?year|sp\.pop\.totl/.test(String(series || '').toLowerCase())) {
    return { status: 'mid-year', basis: 'mid-year', iso3: iso3 || null, reason: 'Mid-year population estimate' };
  }
  if (known === 'census-night' || /census/.test(String(series || '').toLowerCase())) {
    return { status: 'census-night', basis: 'census-night', iso3: iso3 || null, reason: 'Census-night vintage — not a mid-year estimate' };
  }
  if (known === '1-january') {
    return { status: '1-january', basis: '1-january', iso3: iso3 || null, reason: 'Population at 1 January' };
  }
  if (known === 'calendar') {
    return { status: 'calendar', basis: 'calendar', iso3: iso3 || null, reason: 'Calendar year' };
  }
  return { status: 'unknown', basis: known, iso3: iso3 || null, reason: 'Time basis not classified' };
}

export function compareVintage(a, b) {
  const left = classifyVintage(a);
  const right = classifyVintage(b);
  if (left.status === 'unknown' || right.status === 'unknown') {
    return { status: 'unknown', left, right, reason: 'One or both vintages are unknown. Do not invent a date shift.' };
  }
  if (left.basis === right.basis) {
    return { status: 'match', left, right, reason: `Both use ${left.basis}` };
  }
  const fiscalMix = (left.basis === 'fiscal' && right.basis === 'calendar') || (left.basis === 'calendar' && right.basis === 'fiscal');
  if (fiscalMix) {
    const reporter = left.reporter || right.reporter;
    return {
      status: 'conflict',
      left,
      right,
      reason: reporter
        ? `Fiscal vs calendar. ${reporter.label}`
        : 'Fiscal-year series vs calendar-year series. Do not join on the year label.',
    };
  }
  if ((left.basis === 'mid-year' && right.basis === 'census-night') || (left.basis === 'census-night' && right.basis === 'mid-year')) {
    return { status: 'conflict', left, right, reason: 'Mid-year estimate vs census-night vintage' };
  }
  if ((left.basis === 'mid-year' && right.basis === '1-january') || (left.basis === '1-january' && right.basis === 'mid-year')) {
    return { status: 'review', left, right, reason: 'Mid-year vs 1 January population — a six-month shift' };
  }
  return { status: 'review', left, right, reason: `${left.basis} vs ${right.basis}` };
}
