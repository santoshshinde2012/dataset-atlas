#!/usr/bin/env node
/** Copy only browser assets into the GitHub Pages artifact and emit crawlable dataset pages. */
import { copyFileSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../js/catalog.js';
import { SITE_BASE } from '../js/config.js';
import { catalogJsonLd, datasetJsonLd, datasetPageHtml } from './schema-dataset.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const files = [
  'index.html',
  'styles.css',
  'data/catalog.json',
  'data/pilot.json',
  'data/energy-co2-example.ipynb',
  'data/crop-rainfall-example.ipynb',
  'data/india-district-subdivision.json',
  'data/samples/india-crop-sample.csv',
  'data/samples/india-rainfall-sample.csv',
  'data/country-codes.json',
  'data/country-regions.json',
  'data/world-110m.json',
  'vendor/d3.v7.min.js',
  'vendor/d3.LICENSE',
  'vendor/topojson-client.min.js',
  'vendor/topojson-client.LICENSE',
  'js/access.js',
  'js/catalog.js',
  'js/citation.js',
  'js/config.js',
  'js/coverage.js',
  'js/dna.js',
  'js/external-catalogs.js',
  'js/filters.js',
  'js/fit.js',
  'js/icons.js',
  'js/kits.js',
  'js/license-use.js',
  'js/link-health.js',
  'js/vendor-globals.js',
  'js/main.js',
  'js/manifest.js',
  'js/resource.js',
  'js/search.js',
  'js/map/map-view.js',
  'js/map/projections.js',
  'js/services/clipboard.js',
  'js/services/storage.js',
  'js/services/toast.js',
  'js/store.js',
  'js/ui/card-rail.js',
  'js/ui/compare.js',
  'js/ui/domain-dock.js',
  'js/ui/filter-rail.js',
  'js/ui/focus-trap.js',
  'js/ui/passport.js',
  'js/ui/tooltip.js',
  'js/ui/topbar.js',
  'js/ui/welcome.js',
  'js/ui/workbench.js',
  'js/url-state.js',
  'js/utils/dom.js',
  'js/utils/text.js',
];

rmSync(output, { recursive: true, force: true });
for (const file of files) {
  const destination = join(output, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(root, file), destination);
}

const catalog = buildCatalog(JSON.parse(readFileSync(join(root, 'data/catalog.json'), 'utf8')));
const siteUrl = SITE_BASE;
mkdirSync(join(output, 'dataset'), { recursive: true });
const sitemapUrls = [siteUrl];
for (const d of catalog) {
  const pageUrl = `${siteUrl}dataset/${d.id}.html`;
  const appUrl = `${siteUrl}index.html`;
  const jsonLd = datasetJsonLd(d, pageUrl);
  writeFileSync(join(output, 'dataset', `${d.id}.html`), datasetPageHtml(d, { pageUrl, appUrl, jsonLd }));
  sitemapUrls.push(pageUrl);
}
writeFileSync(join(output, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    sitemapUrls.map((loc) => `  <url><loc>${loc}</loc></url>`).join('\n')
  }\n</urlset>\n`);
writeFileSync(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
writeFileSync(join(output, 'catalog.jsonld'), JSON.stringify(catalogJsonLd(siteUrl, catalog.length), null, 2));
console.log(`Built ${files.length} browser files + ${catalog.length} dataset pages in dist/`);
