/**
 * Access-requirement signal: warn users about account/registration walls
 * BEFORE they click out to a source. Pure derivation from existing fields.
 */

/**
 * @returns {{label: string, level: 'account'|'signup'|'restricted'}|null}
 * null means the source is expected to be freely reachable.
 */
export function accessRequirement(d) {
  if (d.sourceType === 'kaggle') {
    return { label: 'Kaggle account', level: 'account' };
  }
  const openness = d.licenseOpenness ?? 0;
  if (openness > 0 && openness <= 0.2) {
    return { label: 'Restricted terms', level: 'restricted' };
  }
  if (openness <= 0.4 || /registration|sign[- ]?up|account/i.test(d.license || '')) {
    return openness <= 0.4
      ? { label: 'Free sign-up', level: 'signup' }
      : { label: 'Free sign-up', level: 'signup' };
  }
  return null;
}
