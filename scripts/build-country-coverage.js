#!/usr/bin/env node
/**
 * Build data/country-coverage.json and attach checked resources.
 *
 * Coverage is non-null country rows only. World Bank and OWID aggregates
 * are dropped. A country missing from a checked series was looked up and
 * had no value — that is not the same as "not checked".
 *
 * Resources are added only after an HTTP 200 from the provider. This script
 * does not invent file URLs from landing pages.
 *
 * Usage: node scripts/build-country-coverage.js
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iso2For, isAggregate } from '../js/identifiers.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(root, 'data/catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const UA = 'DatasetAtlasBot/1.0';

function fetchBytes(url, maxBytes = 30_000_000) {
  const buf = execFileSync('python3', ['-c', `
import sys, urllib.request
url = sys.argv[1]
limit = int(sys.argv[2])
req = urllib.request.Request(url, headers={'User-Agent': sys.argv[3]})
with urllib.request.urlopen(req, timeout=90) as res:
    if res.status != 200:
        sys.exit(2)
    data = res.read(limit + 1)
    if len(data) > limit:
        sys.exit(3)
    sys.stdout.buffer.write(data)
`, url, String(maxBytes), UA], { maxBuffer: maxBytes + 1024 });
  return buf;
}

function headOk(url) {
  try {
    const out = execFileSync('python3', ['-c', `
import sys, urllib.request
url = sys.argv[1]
req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': sys.argv[2]})
try:
    with urllib.request.urlopen(req, timeout=40) as res:
        ctype = res.headers.get('content-type') or ''
        print(res.status)
        print(ctype.split(';')[0].strip())
        print(res.headers.get('content-length') or '')
except Exception:
    req = urllib.request.Request(url, headers={'User-Agent': sys.argv[2], 'Range': 'bytes=0-0'})
    with urllib.request.urlopen(req, timeout=40) as res:
        ctype = res.headers.get('content-type') or ''
        print(res.status if res.status < 400 else 200)
        print(ctype.split(';')[0].strip())
        print('')
`, url, UA], { encoding: 'utf8' });
    const [status, ctype] = out.trim().split('\n');
    const ok = Number(status) >= 200 && Number(status) < 400;
    const html = /html/i.test(ctype || '');
    return ok && !html;
  } catch {
    return false;
  }
}

function spanFor(rowsByIso) {
  const out = {};
  for (const [iso, years] of rowsByIso) {
    if (!years.size) continue;
    const sorted = [...years].sort((a, b) => a - b);
    out[iso] = [sorted[0], sorted[sorted.length - 1]];
  }
  return out;
}

function remember(map, code, year) {
  const iso3 = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso3) || isAggregate(iso3)) return;
  const iso2 = iso2For(iso3);
  if (!iso2) return;
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1800 || y > 2100) return;
  if (!map.has(iso2)) map.set(iso2, new Set());
  map.get(iso2).add(y);
}

function parseWideBank(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIdx = lines.findIndex((line) => line.startsWith('"Country Name"') || line.startsWith('Country Name'));
  if (headerIdx < 0) return { spans: {}, sample: null };
  const header = splitCsv(lines[headerIdx]);
  const codeAt = header.indexOf('Country Code');
  const nameAt = header.indexOf('Country Name');
  const years = header.map((h, i) => (/^\d{4}$/.test(h) ? [i, Number(h)] : null)).filter(Boolean);
  const map = new Map();
  const sampleRows = [];
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.trim()) continue;
    const cells = splitCsv(line);
    const code = cells[codeAt];
    const iso3 = String(code || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso3) || isAggregate(iso3) || !iso2For(iso3)) continue;
    for (const [idx, year] of years) {
      const value = cells[idx];
      if (value !== undefined && value !== '') remember(map, iso3, year);
    }
    if (sampleRows.length < 3) {
      const latest = [...years].reverse().find(([idx]) => cells[idx]);
      if (latest) sampleRows.push([cells[nameAt] || iso3, iso2For(iso3), cells[latest[0]], String(latest[1])]);
    }
  }
  const sample = sampleRows.length
    ? { columns: ['Country', 'ISO2', 'Value', 'Year'], rows: sampleRows, source: 'World Bank CSV (3 non-aggregate rows)' }
    : null;
  return { spans: spanFor(map), sample };
}

function parseLongCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { spans: {}, sample: null };
  const header = splitCsv(lines[0]);
  const codeAt = ['Code', 'iso_code', 'ISO3', 'Country Code'].map((name) => header.indexOf(name)).find((i) => i >= 0);
  const yearAt = ['Year', 'year'].map((name) => header.indexOf(name)).find((i) => i >= 0);
  const entityAt = header.indexOf('Entity');
  if (codeAt === undefined || yearAt === undefined) return { spans: {}, sample: null };
  const map = new Map();
  const sampleRows = [];
  const keep = header.slice(0, 6);
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line);
    const code = cells[codeAt];
    if (!code) continue;
    remember(map, code, cells[yearAt]);
    if (sampleRows.length < 3 && iso2For(String(code).toUpperCase()) && !isAggregate(String(code).toUpperCase())) {
      sampleRows.push(keep.map((_, i) => cells[i] ?? ''));
    }
  }
  const sample = sampleRows.length
    ? { columns: keep, rows: sampleRows, source: 'First country rows of the provider CSV' }
    : null;
  return { spans: spanFor(map), sample: entityAt >= 0 ? sample : null };
}

function splitCsv(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function zipCsv(bytes) {
  const tmp = join(root, 'data/.coverage-tmp.zip');
  writeFileSync(tmp, bytes);
  const text = execFileSync('python3', ['-c', `
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
names = [n for n in z.namelist() if n.lower().endswith('.csv') and 'metadata' not in n.lower()]
sys.stdout.write(z.read(names[0]).decode('utf-8', 'replace'))
`, tmp], { encoding: 'utf8', maxBuffer: 20_000_000 });
  return text;
}

const series = {};
let addedResources = 0;
let addedSamples = 0;

function setSeries(url, spans) {
  if (spans && Object.keys(spans).length) series[url] = spans;
}

for (const dataset of catalog.datasets) {
  const download = (dataset.resources || []).find((r) => r.kind === 'download' && /worldbank\.org/.test(r.url));
  if (!download) continue;
  process.stdout.write(`WB ${download.url.slice(-40)}\n`);
  try {
    const { spans, sample } = parseWideBank(zipCsv(fetchBytes(download.url, 2_000_000)));
    setSeries(dataset.url, spans);
    if (sample && !dataset.sample) {
      dataset.sample = { ...sample, source: download.url };
      addedSamples++;
    }
  } catch (err) {
    console.warn('  skip', err.message);
  }
}

const longDownloads = catalog.datasets.flatMap((dataset) =>
  (dataset.resources || [])
    .filter((r) => r.kind === 'download' && /\.csv(\?|$)/i.test(r.url) && !/worldbank\.org/.test(r.url))
    .map((r) => ({ dataset, url: r.url })));

for (const { dataset, url } of longDownloads) {
  process.stdout.write(`CSV ${url.slice(0, 90)}\n`);
  try {
    const bytes = fetchBytes(url, 16_000_000);
    if (bytes.length >= 16_000_000) { console.warn('  too large'); continue; }
    const { spans, sample } = parseLongCsv(bytes.toString('utf8'));
    setSeries(dataset.url, spans);
    if (sample && bytes.length < 1_500_000 && !dataset.sample) {
      dataset.sample = { ...sample, source: url };
      addedSamples++;
    }
  } catch (err) {
    console.warn('  skip', err.message);
  }
}

const FORMAT_RANK = { CSV: 0, XLSX: 1, GEOJSON: 2, JSON: 3, SHP: 4, ZIP: 5 };
function hdxResources(id) {
  const raw = fetchBytes(`https://data.humdata.org/api/3/action/package_show?id=${encodeURIComponent(id)}`, 2_000_000).toString('utf8');
  const resources = JSON.parse(raw)?.result?.resources || [];
  return resources
    .map((r) => ({
      url: r.url,
      format: String(r.format || 'ZIP').toUpperCase(),
      label: String(r.name || r.format || 'HDX file').slice(0, 80),
    }))
    .filter((r) => /^https:\/\//.test(r.url || '') && FORMAT_RANK[r.format] !== undefined)
    .sort((a, b) => FORMAT_RANK[a.format] - FORMAT_RANK[b.format]);
}

for (const dataset of catalog.datasets) {
  if ((dataset.resources || []).length) continue;
  const hdx = dataset.url.match(/^https:\/\/data\.humdata\.org\/dataset\/([^/?#]+)/);
  if (!hdx) continue;
  process.stdout.write(`HDX ${hdx[1]}\n`);
  try {
    const picks = [];
    for (const resource of hdxResources(hdx[1])) {
      if (picks.length >= 2) break;
      if (!headOk(resource.url)) continue;
      picks.push({ url: resource.url, format: resource.format === 'GEOJSON' ? 'GeoJSON' : resource.format, kind: 'download', label: resource.label });
    }
    if (picks.length) {
      dataset.resources = picks;
      addedResources++;
    }
  } catch (err) {
    console.warn('  skip', err.message);
  }
}

for (const dataset of catalog.datasets) {
  if ((dataset.resources || []).length) continue;
  const code = dataset.url.match(/(?:products-datasets\/-\/|databrowser\/view\/)([a-z0-9_]+)/i)?.[1];
  if (!code) continue;
  const url = `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/${code}?format=TSV&compressed=true`;
  process.stdout.write(`EU ${code}\n`);
  if (!headOk(url)) continue;
  dataset.resources = [{ url, format: 'TSV', kind: 'download', label: `Eurostat ${code} TSV` }];
  addedResources++;
}

for (const dataset of catalog.datasets) {
  if ((dataset.resources || []).length) continue;
  if (!/faostat\/en\/#data\/QCL/i.test(dataset.url) && !/faostat\/en\/#data\/QCL/i.test(dataset.landingPage || '')) continue;
  const url = 'https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip';
  process.stdout.write('FAO QCL\n');
  if (!headOk(url)) continue;
  dataset.resources = [{ url, format: 'ZIP', kind: 'download', label: 'FAOSTAT QCL bulk ZIP' }];
  addedResources++;
}

const coverage = {
  generated: new Date().toISOString().slice(0, 10),
  note: 'Non-null country-year or wide-year observations. World Bank and OWID aggregates are excluded. A listed dataset with no entry for a country was checked and had no value. Datasets absent from series were not checked.',
  series,
};
writeFileSync(join(root, 'data/country-coverage.json'), `${JSON.stringify(coverage)}\n`);
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 1)}\n`);
try { unlinkSync(join(root, 'data/.coverage-tmp.zip')); } catch { /* no zip this run */ }
console.log(`series ${Object.keys(series).length}, new resource entries ${addedResources}, samples ${addedSamples}`);
