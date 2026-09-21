#!/usr/bin/env node
/**
 * Catalog gatekeeper: run after editing data/catalog.json.
 *
 * Re-uses the app's own sanitizer so "valid here" means "renders there",
 * then applies stricter editorial rules the runtime tolerates silently
 * (the app drops bad entries; the catalog file should contain none).
 *
 * Usage: npm run validate
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sanitizeEntry } from '../js/catalog.js';
import { DOMAIN_META, REGION_META, GLOBAL_REGION, PRESETS } from '../js/config.js';
import { KITS } from '../js/kits.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(join(root, 'data/catalog.json'), 'utf8'));
const entries = raw.datasets || raw;
const pilot = JSON.parse(readFileSync(join(root, 'data/pilot.json'), 'utf8'));

const errors = [];
const warnings = [];
const seenUrls = new Map();

entries.forEach((d, i) => {
  const label = `#${i + 1} "${(d && d.title) || 'untitled'}"`;
  const e = sanitizeEntry(d);
  if (!e) {
    errors.push(`${label}: rejected by sanitizer (url scheme/control chars, domain, or region)`);
    return;
  }
  // editorial rules beyond runtime tolerance
  const url = e.url.toLowerCase().replace(/\/+$/, '');
  if (seenUrls.has(url)) errors.push(`${label}: duplicate url of ${seenUrls.get(url)}`);
  seenUrls.set(url, label);
  if (e.sourceType === 'kaggle' && !e.kaggleRef) warnings.push(`${label}: kaggle source without kaggleRef`);
  if (e.kaggleRef && !e.url.includes(e.kaggleRef)) warnings.push(`${label}: kaggleRef not found in url`);
  if (e.coverageStart > e.coverageEnd) errors.push(`${label}: coverageStart > coverageEnd`);
  if (d.sourceModifiedYear !== undefined && e.sourceModifiedYear !== d.sourceModifiedYear) errors.push(`${label}: invalid sourceModifiedYear`);
  if (e.description.length > 320) warnings.push(`${label}: description over 320 chars`);
});

// coverage matrix: every domain and region should stay populated
const byDomain = {}, byRegion = {};
for (const d of entries.map(sanitizeEntry).filter(Boolean)) {
  byDomain[d.domain] = (byDomain[d.domain] || 0) + 1;
  byRegion[d.region] = (byRegion[d.region] || 0) + 1;
}
for (const key of Object.keys(DOMAIN_META)) {
  if (!byDomain[key]) warnings.push(`domain "${key}" has no datasets`);
}
for (const key of [...Object.keys(REGION_META), GLOBAL_REGION]) {
  if (!byRegion[key]) warnings.push(`region "${key}" has no datasets`);
}

// starter bundles must always resolve — a renamed/removed URL breaks concept C
const allUrls = new Set(entries.map((d) => (d.url || '').toLowerCase().replace(/\/+$/, '')));
for (const p of PRESETS) {
  for (const url of p.bundle || []) {
    if (!allUrls.has(url.toLowerCase().replace(/\/+$/, ''))) {
      errors.push(`preset "${p.label}": bundle URL not in catalog — ${url}`);
    }
  }
}

// The research pilot must resolve to curated catalog entries and safe source URLs.
if (pilot.tasks.length < 3 || pilot.profiles.length < 15) errors.push('pilot requires at least 3 tasks and 15 profiles');
const taskIds = new Set(pilot.tasks.map((task) => task.id));
const profileUrls = new Set();
for (const profile of pilot.profiles) {
  if (!allUrls.has(profile.url.toLowerCase().replace(/\/+$/, ''))) errors.push(`pilot URL missing from catalog: ${profile.url}`);
  if (!taskIds.has(profile.task)) errors.push(`pilot task missing: ${profile.task}`);
  if (profileUrls.has(profile.url)) errors.push(`duplicate pilot URL: ${profile.url}`);
  profileUrls.add(profile.url);
  for (const url of [profile.evidence, profile.resource?.url, profile.preview?.source].filter(Boolean)) {
    if (!/^https:\/\/[^\s\x00-\x1f\x7f"'<>\\`]+$/i.test(url)) errors.push(`unsafe pilot URL: ${url}`);
  }
  if (!profile.evidence || !profile.access || !Array.isArray(profile.variables) || !Array.isArray(profile.joinKeys)) errors.push(`incomplete pilot profile: ${profile.url}`);
  if (profile.preview && (!profile.columns || profile.preview.rows.some((row) => row.length !== profile.preview.columns.length))) errors.push(`invalid preview: ${profile.url}`);
}

for (const kit of KITS) {
  for (const url of kit.pair) {
    if (!allUrls.has(url.toLowerCase().replace(/\/+$/, ''))) errors.push(`kit "${kit.id}" URL missing from catalog: ${url}`);
  }
  for (const file of [kit.notebook, kit.crosswalk, ...(kit.samples || [])].filter(Boolean)) {
    if (!existsSync(join(root, file))) errors.push(`kit "${kit.id}" missing file ${file}`);
  }
}

for (const d of entries) {
  const e = sanitizeEntry(d);
  if (!e) continue;
  if (d.resources) {
    if (e.resources.length !== d.resources.length) errors.push(`"${d.title}": resource URL rejected by sanitizer`);
  }
}


console.log(`catalog: ${entries.length} entries, ${errors.length} errors, ${warnings.length} warnings`);
for (const w of warnings) console.warn(`  warn: ${w}`);
for (const e of errors) console.error(`  ERROR: ${e}`);
process.exit(errors.length ? 1 : 0);
