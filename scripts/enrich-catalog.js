#!/usr/bin/env node
/**
 * One-shot editorial enricher: adds DCAT resources, coverageKind and
 * providerId without inventing downloads. Run from repo root.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferCoverageKind } from '../js/coverage.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'data/catalog.json');
const raw = JSON.parse(readFileSync(path, 'utf8'));

const HOST_PROVIDER = [
  [/data\.worldbank\.org|datacatalog\.worldbank\.org|microdata\.worldbank\.org|api\.worldbank\.org/, 'worldbank'],
  [/ourworldindata\.org|github\.com\/owid\//, 'owid'],
  [/kaggle\.com/, 'kaggle'],
  [/data\.gov\.in/, 'data-gov-in'],
  [/catalog\.data\.gov|data\.gov/, 'data-gov'],
  [/data\.humdata\.org/, 'hdx'],
  [/ec\.europa\.eu/, 'eurostat'],
  [/fao\.org/, 'fao'],
  [/who\.int/, 'who'],
  [/registry\.opendata\.aws/, 'aws-roda'],
  [/abs\.gov\.au/, 'abs'],
  [/data\.gov\.sg/, 'data-gov-sg'],
  [/github\.com/, 'github'],
];

function providerId(url) {
  for (const [re, id] of HOST_PROVIDER) if (re.test(url)) return id;
  try { return new URL(url).hostname.replace(/^www\./, '').split('.')[0]; }
  catch { return undefined; }
}

const WB = /^https:\/\/data\.worldbank\.org\/indicator\/([A-Z0-9._]+)(?:\?|$)/i;
const OWID_FILES = {
  'https://github.com/owid/energy-data': {
    url: 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv',
    format: 'CSV', kind: 'download', label: 'OWID energy CSV',
  },
  'https://github.com/owid/co2-data': {
    url: 'https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv',
    format: 'CSV', kind: 'download', label: 'OWID CO2 CSV',
  },
  'https://github.com/owid/covid-19-data/tree/master/public/data': {
    url: 'https://catalog.ourworldindata.org/garden/covid/latest/compact/compact.csv',
    format: 'CSV', kind: 'download', label: 'OWID COVID compact CSV',
  },
  'https://ourworldindata.org/crop-yields': {
    url: 'https://ourworldindata.org/grapher/cereal-yield.csv',
    format: 'CSV', kind: 'download', label: 'OWID cereal yield CSV',
  },
};

function resourcesFor(d) {
  if (Array.isArray(d.resources) && d.resources.length) return d.resources;
  const wb = d.url.match(WB);
  if (wb) {
    const code = wb[1];
    return [
      { url: `https://api.worldbank.org/v2/en/indicator/${code}?downloadformat=csv`, format: 'CSV', kind: 'download', label: 'World Bank CSV ZIP' },
      { url: `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=20000`, format: 'JSON', kind: 'api', label: 'World Bank API (paginated)' },
    ];
  }
  if (OWID_FILES[d.url]) return [OWID_FILES[d.url]];
  const grapher = d.url.match(/^https:\/\/ourworldindata\.org\/grapher\/([A-Za-z0-9-]+)\/?$/);
  if (grapher) {
    return [{ url: `${d.url.replace(/\/$/, '')}.csv`, format: 'CSV', kind: 'download', label: 'OWID grapher CSV' }];
  }
  return [];
}

for (const d of raw.datasets) {
  d.landingPage = d.url;
  d.providerId = providerId(d.url);
  d.resources = resourcesFor(d);
  d.coverageKind = inferCoverageKind({ ...d, coverageKind: undefined });
}

writeFileSync(path, JSON.stringify(raw, null, 2) + '\n');
const withFiles = raw.datasets.filter((d) => (d.resources || []).some((r) => r.kind === 'download')).length;
console.log(`enriched ${raw.datasets.length} entries; ${withFiles} have a download resource`);
