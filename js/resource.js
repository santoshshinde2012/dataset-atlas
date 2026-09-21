/**
 * DCAT-inspired access model: a dataset landing page is not a file.
 *
 * Single responsibility: sanitize and select distributions. Callers never
 * invent a download URL — unknown access stays unknown.
 */
const URL_OK = /^https?:\/\/[^\s\x00-\x1f\x7f"'<>\\`]+$/i;
const KINDS = new Set(['download', 'api', 'page']);
const clean = (s, max) => String(s || '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max);

export function sanitizeResources(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw.slice(0, 8)) {
    if (!item || typeof item !== 'object') continue;
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    if (!URL_OK.test(url) || seen.has(url)) continue;
    seen.add(url);
    const kind = KINDS.has(item.kind) ? item.kind : 'page';
    out.push({
      url,
      kind,
      format: clean(item.format, 40) || 'Other',
      label: clean(item.label, 80) || (kind === 'api' ? 'API' : kind === 'download' ? 'File' : 'Page'),
    });
  }
  return out;
}

export function sanitizeLandingPage(value, fallbackUrl) {
  const url = typeof value === 'string' ? value.trim() : '';
  if (URL_OK.test(url)) return url;
  return fallbackUrl;
}

/** First verified file or API distribution, else null. Never guesses. */
export function primaryResource(d) {
  const resources = d?.resources || [];
  return resources.find((r) => r.kind === 'download')
    || resources.find((r) => r.kind === 'api')
    || null;
}

/**
 * Honest card/compare actions.
 * @returns {{primary: object, secondary?: object, copy: object}}
 */
export function accessAction(d) {
  const page = d.landingPage || d.url;
  if (d.kaggleRef) {
    return {
      primary: { kind: 'page', href: page, label: 'Open source' },
      copy: { kind: 'cli', text: `kaggle datasets download -d ${d.kaggleRef}`, label: 'Copy CLI' },
    };
  }
  const resource = primaryResource(d);
  if (resource) {
    return {
      primary: {
        kind: resource.kind,
        href: resource.url,
        label: resource.kind === 'api' ? 'Open API' : 'Download file',
      },
      secondary: { kind: 'page', href: page, label: 'Source page' },
      copy: { kind: 'url', text: resource.url, label: 'Copy file URL' },
    };
  }
  return {
    primary: { kind: 'page', href: page, label: 'Open source' },
    copy: { kind: 'url', text: page, label: 'Copy link' },
  };
}

/** Shell-comment recipe lines for the Data Passport (no executable curl of HTML). */
export function resourceLines(d) {
  const lines = [];
  if (d.kaggleRef) {
    lines.push({ executable: true, text: `kaggle datasets download -d ${d.kaggleRef}` });
    lines.push({ executable: false, text: d.url });
    return lines;
  }
  const resource = primaryResource(d);
  if (resource?.kind === 'download') {
    lines.push({ executable: false, text: `direct file: ${resource.url}` });
    lines.push({ executable: false, text: `source page: ${d.landingPage || d.url}` });
    return lines;
  }
  if (resource?.kind === 'api') {
    lines.push({ executable: false, text: `api: ${resource.url}` });
    lines.push({ executable: false, text: `source page: ${d.landingPage || d.url}` });
    return lines;
  }
  lines.push({ executable: false, text: d.landingPage || d.url });
  return lines;
}
