/**
 * Link health is URL reachability, not dataset quality or content year.
 */
const DAY = 24 * 60 * 60 * 1000;

function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const t = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(t) ? t : null;
}

/**
 * @param {object} d
 * @param {string|null} generated catalog check date
 * @param {number} [now]
 */
export function linkHealth(d, generated = null, now = Date.now()) {
  const verifiedAt = parseDay(d?.verified);
  if (!verifiedAt) {
    return {
      status: 'unknown',
      label: 'Link not recently verified',
      title: 'No successful HTTP check is recorded. The source page may still work.',
    };
  }
  const ageDays = Math.max(0, Math.round((now - verifiedAt) / DAY));
  const stale = ageDays > 14;
  const generatedAt = parseDay(generated);
  const failedLatestCheck = generatedAt && verifiedAt < generatedAt;
  if (failedLatestCheck || stale) {
    return {
      status: 'stale',
      label: failedLatestCheck ? `Unreachable as of ${generated}` : `Last verified ${d.verified}`,
      title: failedLatestCheck
        ? `The ${generated} catalog check did not refresh this URL. Replace or confirm the source.`
        : `Last successful response ${d.verified} (${ageDays} days ago).`,
      lastVerified: d.verified,
    };
  }
  return {
    status: 'verified',
    label: `Link checked ${d.verified}`,
    title: `URL returned a successful response on ${d.verified}. That is not a content-quality stamp.`,
    lastVerified: d.verified,
  };
}
