/**
 * Screening labels for analysis / redistribution / AI training.
 * Unknown stays unknown. This is not legal advice.
 * An unspecified license is never treated as public domain.
 */
const YES = 'yes';
const NO = 'no';
const UNKNOWN = 'unknown';
const TERMS = 'with-terms';
const SHARE_ALIKE = 'share-alike';
const NC = 'no-commercial';
const LIKELY = 'likely';

const unspecified = (license) => {
  const text = String(license || '').trim().toLowerCase();
  return !text || text === 'unknown' || text === 'unspecified' || text === 'n/a' || text === 'none';
};

export function licenseUse(d) {
  const license = String(d?.license || '');
  const text = license.toLowerCase();
  const open = d?.licenseOpenness ?? 0;
  const licenseUrl = typeof d?.licenseUrl === 'string' && /^https?:\/\//i.test(d.licenseUrl) ? d.licenseUrl : null;

  if (unspecified(license)) {
    return {
      analysis: UNKNOWN,
      redistribute: UNKNOWN,
      aiTraining: UNKNOWN,
      license: license || 'Unknown',
      licenseUrl,
      specified: false,
      portalTerms: d?.sourceType === 'kaggle' ? 'Kaggle dataset terms are separate from a missing file license' : null,
      note: 'License is unspecified. Unspecified is not public domain. Confirm at the source. Screening label, not a license grant.',
    };
  }

  const cc0 = /cc0|public domain/.test(text);
  const nc = /non-?commercial|cc by-nc/.test(text);
  const sa = /share-?alike|cc by-sa|odbl/.test(text);
  const by = /cc by/.test(text) && !nc;
  const ogd = /open government|ogdl|singapore open data|bahrain government open/.test(text);

  let analysis = UNKNOWN;
  let redistribute = UNKNOWN;
  let aiTraining = UNKNOWN;

  if (cc0) {
    analysis = YES;
    redistribute = YES;
    aiTraining = LIKELY;
  } else if (by) {
    analysis = YES;
    redistribute = sa ? SHARE_ALIKE : YES;
    aiTraining = LIKELY;
  } else if (nc) {
    analysis = TERMS;
    redistribute = NC;
    aiTraining = NC;
  } else if (ogd || open >= 0.6) {
    analysis = YES;
    redistribute = TERMS;
    aiTraining = UNKNOWN;
  } else if (open >= 0.4) {
    analysis = TERMS;
    redistribute = UNKNOWN;
    aiTraining = UNKNOWN;
  } else if (open > 0 && open <= 0.2) {
    analysis = NO;
    redistribute = NO;
    aiTraining = NO;
  }

  if (d?.sourceType === 'kaggle' && aiTraining === LIKELY) aiTraining = TERMS;

  return {
    analysis,
    redistribute,
    aiTraining,
    license,
    licenseUrl,
    specified: true,
    portalTerms: d?.sourceType === 'kaggle' ? 'Kaggle ToS can restrict use even when the file license looks open' : null,
    note: 'Confirm at the source. Screening label, not a license grant.',
  };
}

export function licenseUseSummary(use) {
  const extra = use.specified === false ? ' · unspecified≠public domain' : '';
  return `analysis ${use.analysis} · redistribute ${use.redistribute} · AI training ${use.aiTraining}${extra}`;
}

/** Short badge. The full license string stays in the tooltip. */
export function licenseBadgeText(license) {
  const text = String(license || 'Unknown');
  const t = text.toLowerCase();
  if (/cc0/.test(t)) return 'CC0';
  if (/public domain/.test(t)) return 'Public domain';
  if (/cc by-nc-sa/.test(t)) return 'CC BY-NC-SA';
  if (/cc by-nc/.test(t)) return 'CC BY-NC';
  if (/cc by-sa/.test(t)) return 'CC BY-SA';
  if (/cc by-nd/.test(t)) return 'CC BY-ND';
  if (/cc by/.test(t)) return 'CC BY';
  if (/odbl/.test(t)) return 'ODbL';
  if (/open government licence/.test(t)) return 'OGL';
  if (/godl|open government data india|government open data license - india/.test(t)) return 'GODL India';
  if (text.length > 32) return `${text.slice(0, 30)}…`;
  return text;
}

/** Known deed URLs only. Vague licenses stay without a link. */
export function knownLicenseUrl(license) {
  const text = String(license || '').toLowerCase();
  if (!text || /unspecified|unknown|custom|other|kaggle/.test(text)) return null;
  if (/cc0/.test(text)) return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (/cc by-nc-sa\s*4/.test(text)) return 'https://creativecommons.org/licenses/by-nc-sa/4.0/';
  if (/cc by-nc-sa\s*3/.test(text)) return 'https://creativecommons.org/licenses/by-nc-sa/3.0/';
  if (/cc by-sa\s*4/.test(text)) return 'https://creativecommons.org/licenses/by-sa/4.0/';
  if (/cc by-nd\s*3/.test(text)) return 'https://creativecommons.org/licenses/by-nd/3.0/';
  if (/cc by\s*4|cc-by-4|cc by-4/.test(text)) return 'https://creativecommons.org/licenses/by/4.0/';
  if (/cc by\s*3\.0\s*igo/.test(text)) return 'https://creativecommons.org/licenses/by/3.0/igo/';
  if (/cc by\s*3\.0\s*au/.test(text)) return 'https://creativecommons.org/licenses/by/3.0/au/';
  if (/cc by\s*3\.0\s*us/.test(text)) return 'https://creativecommons.org/licenses/by/3.0/us/';
  if (/cc by\s*2\.5/.test(text)) return 'https://creativecommons.org/licenses/by/2.5/';
  if (/odbl/.test(text)) return 'https://opendatacommons.org/licenses/odbl/1-0/';
  if (/open government licence v3/.test(text)) return 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
  return null;
}
