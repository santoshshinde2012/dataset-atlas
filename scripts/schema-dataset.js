/**
 * schema.org Dataset JSON-LD and crawlable page HTML.
 * Node-only (used by build-site). Not a browser module.
 */
import { licenseUse, licenseUseSummary } from '../js/license-use.js';
import { primaryResource } from '../js/resource.js';
import { AUTHOR } from '../js/config.js';

export function personJsonLd() {
  const home = AUTHOR.links.find((link) => link.id === 'github') || AUTHOR.links[0];
  return {
    '@type': 'Person',
    name: AUTHOR.name,
    url: home.href,
    sameAs: AUTHOR.links.map((link) => link.href),
  };
}

export function datasetJsonLd(d, pageUrl) {
  const resource = primaryResource(d);
  const graph = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: d.title,
    description: d.description,
    url: pageUrl,
    identifier: d.id,
    license: d.license,
    creator: { '@type': 'Organization', name: d.source },
    temporalCoverage: `${d.coverageStart}/${d.coverageEnd}`,
    isAccessibleForFree: (d.licenseOpenness || 0) >= 0.6,
    sameAs: d.landingPage || d.url,
  };
  if (d.keywords) graph.keywords = d.keywords;
  else graph.keywords = [d.domain, d.region, d.sourceType].filter(Boolean);
  if (resource) {
    graph.distribution = {
      '@type': 'DataDownload',
      encodingFormat: resource.format,
      contentUrl: resource.url,
    };
  }
  return graph;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function datasetPageHtml(d, { pageUrl, appUrl, jsonLd }) {
  const use = licenseUse(d);
  const resource = primaryResource(d);
  const source = d.landingPage || d.url;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(d.title)} — Dataset Atlas</title>
<meta name="description" content="${esc(d.description).slice(0, 240)}" />
<link rel="canonical" href="${esc(pageUrl)}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  body { font-family: Georgia, serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #122; }
  a { color: #0e7490; } .meta { color: #445; font-size: 0.95rem; }
  .note { background: #f3f7fa; padding: 0.75rem 1rem; border-radius: 8px; }
</style>
</head>
<body>
<p><a href="${esc(appUrl)}">The Dataset Atlas</a> · curated entry</p>
<h1>${esc(d.title)}</h1>
<p>${esc(d.description)}</p>
<p class="meta">
  Source: ${esc(d.source)} · Domain: ${esc(d.domain)} · Region: ${esc(d.region)}<br>
  Coverage: ${d.coverageStart}–${d.coverageEnd} · Grain: ${esc(d.granularity || 'country')}<br>
  License: ${esc(d.license)} · ${esc(licenseUseSummary(use))}<br>
  ${d.verified ? `Link checked ${esc(d.verified)} (URL reachability, not content quality).` : 'Link check not recorded.'}
</p>
<p><a href="${esc(source)}">Source page</a>${resource ? ` · <a href="${esc(resource.url)}">${resource.kind === 'api' ? 'API' : 'File'}</a>` : ''} · <a href="${esc(appUrl)}#p=${esc(d.id)}">Open in the atlas</a></p>
<p class="note">${esc(use.note)} A successful link check is not a guarantee that the file matches this description.</p>
</body>
</html>
`;
}

export function catalogJsonLd(siteUrl, count) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: 'The Dataset Atlas',
    url: siteUrl,
    description: 'A curated, map-first catalog of public-interest datasets with verified access and join evidence.',
    numberOfItems: count,
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    creator: personJsonLd(),
  };
}
