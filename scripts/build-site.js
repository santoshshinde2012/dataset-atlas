#!/usr/bin/env node
/** Copy only browser assets into the GitHub Pages artifact. */
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const files = [
  'index.html',
  'styles.css',
  'data/catalog.json',
  'data/country-codes.json',
  'data/country-regions.json',
  'data/world-110m.json',
  'vendor/d3.v7.min.js',
  'vendor/topojson-client.min.js',
  'js/access.js',
  'js/catalog.js',
  'js/citation.js',
  'js/config.js',
  'js/dna.js',
  'js/filters.js',
  'js/icons.js',
  'js/lib.js',
  'js/main.js',
  'js/manifest.js',
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
  'js/ui/passport.js',
  'js/ui/tooltip.js',
  'js/ui/topbar.js',
  'js/ui/welcome.js',
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
console.log(`Built ${files.length} browser files in dist/`);
