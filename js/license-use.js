/**
 * Screening labels for analysis / redistribution / AI training.
 * Unknown stays unknown. This is not legal advice.
 */
const YES = 'yes';
const NO = 'no';
const UNKNOWN = 'unknown';
const TERMS = 'with-terms';
const SHARE_ALIKE = 'share-alike';
const NC = 'no-commercial';
const LIKELY = 'likely';

export function licenseUse(d) {
  const license = String(d?.license || '');
  const text = license.toLowerCase();
  const open = d?.licenseOpenness ?? 0;
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
    note: 'Confirm at the source. Screening label, not a license grant.',
  };
}

export function licenseUseSummary(use) {
  return `analysis ${use.analysis} · redistribute ${use.redistribute} · AI training ${use.aiTraining}`;
}
