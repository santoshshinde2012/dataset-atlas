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
