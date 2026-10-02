/**
 * Access-requirement signal: warn users about account/registration walls
 * BEFORE they click out to a source. Pure derivation from existing fields.
 */

/**
 * @returns {{label: string, level: 'account'|'signup'|'restricted'}|null}
 * null means no account requirement is recorded; it does not prove free access.
 */
export function accessRequirement(d) {
  if (d.sourceType === 'kaggle') {
    return { label: 'Kaggle account', level: 'account' };
  }
  if (/registration|sign[- ]?up|account/i.test(d.license || '')) {
    return { label: 'Sign-up required', level: 'signup' };
  }
  const openness = d.licenseOpenness ?? 0;
  if (openness > 0 && openness <= 0.4) {
    return { label: 'Review source terms', level: 'restricted' };
  }
  return null;
}
