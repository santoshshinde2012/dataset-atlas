#!/usr/bin/env node
/**
 * Atlas MCP server — the agent interface to the Dataset Atlas.
 *
 * A single-file, zero-dependency stdio MCP server (newline-delimited
 * JSON-RPC 2.0) that exposes the catalog to any MCP client — Claude Code,
 * Claude Desktop, or an Agent SDK agent — as four typed tools:
 *
 *   search_catalog   faceted query + ranking over the verified catalog
 *   get_dataset      full metadata + DNA profile for one entry
 *   get_resource     landing page vs file/API, license-use, link health
 *   list_bundles     the curated "I want to…" starter bundles
 *   list_kits        verified and documented join kits
 *   assess_fit       workbench fit + pair join for a research task
 *   build_passport   source inventory and download commands + BibTeX + share link
 *
 * Every tool body reuses the app's own pure modules — the catalog always
 * flows through the js/catalog.js sanitization choke point, manifests
 * through js/manifest.js hardening — so agent output is byte-identical to
 * what the UI produces. Loads data/catalog.json from the repo when present,
 * else fetches the live GitHub Pages copy (so the server runs from a bare
 * checkout of just this file plus the js/ modules).
 *
 * Register in .mcp.json (checked in) or run directly:
 *   node scripts/atlas-mcp.js
 */
import { readFileSync } from 'node:fs';
import { queryTerms, searchScore } from '../js/search.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCatalog } from '../js/catalog.js';
import { filterCatalog } from '../js/filters.js';
import { dnaMetrics } from '../js/dna.js';
import { manifestText } from '../js/manifest.js';
import { bibliographyFor } from '../js/citation.js';
import { countryCoverage } from '../js/coverage.js';
import { accessAction, primaryResource } from '../js/resource.js';
import { licenseUse } from '../js/license-use.js';
import { linkHealth } from '../js/link-health.js';
import { KITS } from '../js/kits.js';
import { assessFit, assessJoin } from '../js/fit.js';
import {
  DOMAIN_META, REGION_META, SOURCE_TYPE_META, GLOBAL_REGION, PRESETS, FORMAT_ORDER, SITE_BASE,
} from '../js/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_BASE = SITE_BASE;
const SERVER_INFO = { name: 'dataset-atlas', version: '1.0.0' };
const PROTOCOL_VERSION = '2025-06-18';

/**
 * Local repo catalog when available, live GitHub Pages catalog otherwise.
 * Only a genuinely absent local file falls back to the network — a present
 * but corrupt catalog.json throws loudly rather than silently serving stale
 * remote data (which would mask a broken local edit).
 */
export async function loadCatalog() {
  let raw;
  try {
    raw = readFileSync(join(root, 'data/catalog.json'), 'utf8');
  } catch (e) {
    if (e?.code !== 'ENOENT') throw e; // permission/IO errors surface, not swallowed
    const res = await fetch(`${LIVE_BASE}data/catalog.json`);
    if (!res.ok) throw new Error(`catalog fetch failed: HTTP ${res.status}`);
    return buildCatalog(await res.json());
  }
  return buildCatalog(JSON.parse(raw)); // parse/shape errors on a present file must fail loudly
}

export function loadPilot() {
  const raw = readFileSync(join(root, 'data/pilot.json'), 'utf8');
  return JSON.parse(raw);
}

/* ---------- tool bodies (pure over a sanitized catalog; exported for tests) ---------- */

const DOMAINS = Object.keys(DOMAIN_META);
const REGIONS = [...Object.keys(REGION_META), GLOBAL_REGION];
const SORTS = ['relevance', 'freshness', 'coverage', 'openness', 'size', 'title'];

const dnaOf = (d) => Object.fromEntries(
  dnaMetrics(d).map((m) => [m.label.toLowerCase(), Math.round(m.value * 100) / 100]));

/** Truncate on a code-point boundary so a surrogate pair is never split. */
const clip = (s, max) => {
  const cps = Array.from(s);
  return cps.length > max ? `${cps.slice(0, max - 3).join('')}...` : s;
};

const compact = (d, extra = {}) => ({
  id: d.id,
  title: d.title,
  source: d.source,
  sourceType: d.sourceType,
  domain: d.domain,
  region: d.region,
  countries: d.countries,
  coverageKind: d.coverageKind,
  url: d.url,
  landingPage: d.landingPage || d.url,
  resources: d.resources || [],
  ...(d.kaggleRef ? { kaggleRef: d.kaggleRef } : {}),
  formats: d.formats,
  license: d.license,
  licenseOpenness: d.licenseOpenness,
  freshnessYear: d.freshnessYear,
  ...(d.sourceModifiedYear ? { sourceModifiedYear: d.sourceModifiedYear } : {}),
  coverage: `${d.coverageStart}-${d.coverageEnd}`,
  granularity: d.granularity || 'country',
  approxSizeMB: d.approxSizeMB,
  ...(d.verified ? { verified: d.verified } : {}),
  description: clip(d.description, 220),
  dna: dnaOf(d),
  ...extra,
});

const shareUrl = (ids) => `${LIVE_BASE}#p=${ids.join('.')}`;

export function searchCatalog(catalog, args = {}) {
  const {
    query = '', domain, region, includeGlobal = true, country,
    sourceTypes, formats, minOpenness = 0, maxSizeMB, sort = 'relevance', limit = 10,
  } = args;
  if (domain !== undefined && !DOMAINS.includes(domain)) throw new Error(`unknown domain "${domain}" — one of: ${DOMAINS.join(', ')}`);
  if (region !== undefined && !REGIONS.includes(region)) throw new Error(`unknown region "${region}" — one of: ${REGIONS.join(', ')}`);
  if (!SORTS.includes(sort)) throw new Error(`unknown sort "${sort}" — one of: ${SORTS.join(', ')}`);
  // validate the array facets up front so typos and wrong types error loudly
  // rather than silently returning zero rows or the whole catalog
  const badType = (name, val, allowed) => {
    if (val === undefined) return null;
    if (!Array.isArray(val)) throw new Error(`${name} must be an array — values from: ${allowed.join(', ')}`);
    const bad = val.find((v) => !allowed.includes(v));
    if (bad !== undefined) throw new Error(`unknown ${name} value "${bad}" — one of: ${allowed.join(', ')}`);
    return val;
  };
  badType('sourceTypes', sourceTypes, Object.keys(SOURCE_TYPE_META));
  // the schema advertises canonical FORMAT_ORDER labels, so keep them verbatim —
  // re-normalizing would fold 'Geo' into 'Other' (normFormat is for raw strings)
  badType('formats', formats, FORMAT_ORDER);

  // the UI's own facet predicates, fed the same state shape the store builds.
  // query is applied as a narrow post-filter below (not via the FACETS.search
  // predicate, which also matches domain/region slugs) so the tool honors its
  // documented title/description/source scope.
  const state = {
    domain: domain || 'all',
    sourceTypes: new Set(Array.isArray(sourceTypes) && sourceTypes.length ? sourceTypes : Object.keys(SOURCE_TYPE_META)),
    formats: new Set(Array.isArray(formats) && formats.length ? formats : FORMAT_ORDER),
    minOpenness: Math.max(0, Math.min(1, +minOpenness || 0)),
    search: '',
    onlyChanged: false,
  };
  let list = filterCatalog(catalog, state);
  const q = String(query).slice(0, 80);
  if (queryTerms(q).length) list = list.filter((d) => searchScore(d, q, { includeFacets: false }) > 0);
  if (region) list = list.filter((d) => d.region === region || (includeGlobal && d.region === GLOBAL_REGION));
  if (maxSizeMB) list = list.filter((d) => d.approxSizeMB <= +maxSizeMB);

  const iso = country ? String(country).toUpperCase() : null;
  const coverageOf = (d) => countryCoverage(d, iso);
  const isMatch = (d) => coverageOf(d) === 'tagged';
  const dnaMean = (d) => dnaMetrics(d).reduce((s, m) => s + m.value, 0) / 5;
  const score = (d) => (isMatch(d) ? 2 : coverageOf(d) === 'series' ? 1 : 0)
    + (q ? searchScore(d, q, { includeFacets: false }) / 5 : 0)
    + dnaMean(d);
  const cmp = {
    relevance: (a, b) => score(b) - score(a),
    freshness: (a, b) => b.freshnessYear - a.freshnessYear,
    coverage: (a, b) => (b.coverageEnd - b.coverageStart) - (a.coverageEnd - a.coverageStart),
    openness: (a, b) => b.licenseOpenness - a.licenseOpenness,
    size: (a, b) => b.approxSizeMB - a.approxSizeMB,
    title: (a, b) => a.title.localeCompare(b.title),
  }[sort];
  list = [...list].sort(cmp);

  const n = Math.max(1, Math.min(50, Math.floor(+limit) || 10));
  return {
    total: list.length,
    returned: Math.min(n, list.length),
    results: list.slice(0, n).map((d) => compact(d, iso ? { countryMatch: isMatch(d), countryCoverage: coverageOf(d) } : {})),
  };
}

export function getDataset(catalog, args = {}) {
  const d = catalog.find((x) => x.id === args.id);
  if (!d) throw new Error(`no dataset with id "${args.id}" — ids come from search_catalog / list_bundles`);
  const action = accessAction(d);
  return {
    ...compact(d),
    description: d.description,
    dnaDetail: dnaMetrics(d).map((m) => ({ metric: m.label, value: Math.round(m.value * 100) / 100, note: m.tip })),
    download: action.copy.kind === 'cli' ? action.copy.text : action.primary.href,
    access: action,
    share_url: shareUrl([d.id]),
  };
}

export function getResource(catalog, args = {}) {
  const d = catalog.find((x) => x.id === args.id);
  if (!d) throw new Error(`no dataset with id "${args.id}"`);
  const resource = primaryResource(d);
  return {
    id: d.id,
    title: d.title,
    landingPage: d.landingPage || d.url,
    resources: d.resources || [],
    primaryResource: resource,
    access: accessAction(d),
    licenseUse: licenseUse(d),
    linkHealth: linkHealth(d),
    coverageKind: d.coverageKind,
    countries: d.countries,
  };
}

export function listKits(catalog) {
  return {
    kits: KITS.map((kit) => ({
      id: kit.id,
      status: kit.status,
      task: kit.task,
      label: kit.label,
      joinNote: kit.joinNote,
      resultGrain: kit.resultGrain,
      notebook: kit.notebook || null,
      crosswalk: kit.crosswalk || null,
      datasets: kit.pair
        .map((url) => catalog.find((d) => d.url === url))
        .filter(Boolean)
        .map((d) => ({ id: d.id, title: d.title, url: d.url, landingPage: d.landingPage || d.url })),
    })),
  };
}

export function assessFitTool(catalog, args = {}, pilot = loadPilot()) {
  const taskBase = (pilot.tasks || []).find((t) => t.id === (args.task || 'energy'));
  if (!taskBase) throw new Error(`unknown task "${args.task}" — one of: ${(pilot.tasks || []).map((t) => t.id).join(', ')}`);
  const task = { ...taskBase };
  if (args.country) task.country = String(args.country).toUpperCase();
  if (args.startYear) task.startYear = Number(args.startYear);
  if (args.endYear) task.endYear = Number(args.endYear);
  if (args.level) task.level = String(args.level);
  const shown = (pilot.profiles || [])
    .filter((profile) => profile.task === task.id)
    .map((profile) => ({ profile, dataset: catalog.find((d) => d.url === profile.url) }))
    .filter((row) => row.dataset);
  const sources = shown.map(({ dataset, profile }) => ({
    id: dataset.id,
    title: dataset.title,
    url: dataset.url,
    fit: assessFit(dataset, profile, task),
    resource: profile.resource || primaryResource(dataset),
  }));
  let pair = null;
  if (shown.length >= 2) {
    const a = args.urlA ? shown.find((row) => row.profile.url === args.urlA) : shown[0];
    const b = args.urlB ? shown.find((row) => row.profile.url === args.urlB) : shown[1];
    if (a && b && a !== b) {
      pair = {
        a: a.dataset.title,
        b: b.dataset.title,
        join: assessJoin(a.profile, b.profile, a.dataset, b.dataset),
      };
    }
  }
  return { task, sources, pair };
}

export function listBundles(catalog) {
  return {
    bundles: PRESETS.map((p, i) => ({
      index: i,
      label: p.label,
      focus: p.sub,
      domain: p.domain,
      datasets: (p.bundle || [])
        .map((url) => catalog.find((d) => d.url === url))
        .filter(Boolean)
        .map((d) => ({ id: d.id, title: d.title, source: d.source, region: d.region })),
    })),
  };
}

export function buildPassport(catalog, args = {}, accessedDate = null) {
  const ids = Array.isArray(args.ids) ? args.ids : [];
  if (!ids.length) throw new Error('ids is required — a non-empty array of dataset ids');
  const byId = new Map(catalog.map((d) => [d.id, d]));
  const entries = [];
  const unknown = new Set();
  for (const id of ids.slice(0, 100)) {
    const d = byId.get(id);
    if (d && !entries.includes(d)) entries.push(d);
    else if (!d) unknown.add(String(id));
  }
  if (!entries.length) throw new Error(`none of the ids matched the catalog: ${[...unknown].join(', ')}`);
  return {
    count: entries.length,
    datasets: entries.map((d) => ({ id: d.id, title: d.title })),
    ...(unknown.size ? { unknown_ids: [...unknown] } : {}),
    manifest_sh: manifestText(entries),
    references_bib: bibliographyFor(entries, accessedDate),
    share_url: shareUrl(entries.map((d) => d.id)),
  };
}

/* ---------- MCP tool registry ---------- */

export function toolDefinitions() {
  return [
    {
      name: 'search_catalog',
      description: 'Search the curated dataset catalog with facets and ranking. Returns compact entries with per-dataset DNA scores (frs freshness, cov coverage span, grn granularity, siz size, lic license openness — each 0-1). Source metadata and license terms should be confirmed at the provider. Pass country (ISO alpha-2) to rank country-tagged datasets first (countryMatch). Regional queries include global datasets unless includeGlobal=false.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'word-order-independent match over title/description/source' },
          domain: { type: 'string', enum: DOMAINS },
          region: { type: 'string', enum: REGIONS },
          includeGlobal: { type: 'boolean', description: 'when region is set, also include global datasets (default true)' },
          country: { type: 'string', description: 'ISO 3166-1 alpha-2, e.g. "IN" — boosts country-tagged entries' },
          sourceTypes: { type: 'array', items: { type: 'string', enum: Object.keys(SOURCE_TYPE_META) } },
          formats: { type: 'array', items: { type: 'string', enum: FORMAT_ORDER } },
          minOpenness: { type: 'number', minimum: 0, maximum: 1, description: 'minimum license openness (1 = public domain)' },
          maxSizeMB: { type: 'number', description: 'drop datasets larger than this' },
          sort: { type: 'string', enum: SORTS, description: 'default relevance (country match + query match + DNA composite)' },
          limit: { type: 'number', minimum: 1, maximum: 50, description: 'default 10' },
        },
      },
    },
    {
      name: 'get_dataset',
      description: 'Full metadata for one dataset: untruncated description, DNA metrics with human-readable notes, the download command (Kaggle CLI when available), and a shareable atlas link.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'dataset id from search_catalog or list_bundles' } },
        required: ['id'],
      },
    },
    {
      name: 'get_resource',
      description: 'Landing page vs verified file/API, reuse screening (analysis/redistribute/AI training), and link health. A missing file is reported as unknown — never invented.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'list_bundles',
      description: 'The curated "I want to…" starter bundles — expert-picked 5-dataset kits per use case (crop yields, disease outbreaks, climate risk, economic modeling, energy transition). Use their dataset ids directly in build_passport.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_kits',
      description: 'Verified and documented join kits (energy/CO2, India crop+rainfall, COVID/population). Verified kits include a runnable notebook. Use assess_fit for the screening result.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'assess_fit',
      description: 'Screen the research-workbench sources for a task. Returns per-source fit and pair join status. match requires documented overlap; key names alone stay review.',
      inputSchema: {
        type: 'object',
        properties: {
          task: { type: 'string', enum: ['crop', 'health', 'energy'] },
          country: { type: 'string', description: 'ISO 3166-1 alpha-2' },
          startYear: { type: 'number' },
          endYear: { type: 'number' },
          level: { type: 'string' },
          urlA: { type: 'string' },
          urlB: { type: 'string' },
        },
      },
    },
    {
      name: 'build_passport',
      description: 'Turn a list of dataset ids into data-passport.sh (source URLs and executable Kaggle commands), references.bib (BibTeX with license and coverage), and a share link that opens the atlas with the collection pre-pinned. Non-Kaggle downloads require manual action.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 100 },
        },
        required: ['ids'],
      },
    },
  ];
}

export async function callTool(catalog, name, args) {
  const today = new Date().toISOString().slice(0, 10);
  switch (name) {
    case 'search_catalog': return searchCatalog(catalog, args);
    case 'get_dataset': return getDataset(catalog, args);
    case 'get_resource': return getResource(catalog, args);
    case 'list_bundles': return listBundles(catalog);
    case 'list_kits': return listKits(catalog);
    case 'assess_fit': return assessFitTool(catalog, args);
    case 'build_passport': return buildPassport(catalog, args, today);
    default: throw new Error(`unknown tool "${name}"`);
  }
}

/* ---------- stdio JSON-RPC 2.0 transport ---------- */

const INSTRUCTIONS = 'Dataset discovery over a curated catalog with verified files and join kits. '
  + 'Typical flow: search_catalog or list_kits -> get_resource to see whether a file exists -> assess_fit for join evidence -> build_passport. '
  + 'Landing pages are not files. A match is screening evidence, not a statistical guarantee.';

const ok = (id, res) => ({ jsonrpc: '2.0', id, result: res });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

/**
 * Route one parsed JSON-RPC message to a reply object, or null when no reply
 * is owed. Per spec a message is a NOTIFICATION iff it has no `id` — routing
 * is by id presence, never by method name — so requests always get exactly
 * one response and notifications get none. Pure and exported for tests.
 */
export async function dispatch(catalog, msg) {
  const isRequest = msg && msg.id !== undefined && msg.id !== null;
  const { id, method, params } = msg || {};
  try {
    let res;
    if (method === 'initialize') {
      res = { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS };
    } else if (method === 'ping') {
      res = {};
    } else if (method === 'tools/list') {
      res = { tools: toolDefinitions() };
    } else if (method === 'tools/call') {
      try {
        const out = await callTool(catalog, params?.name, params?.arguments || {});
        res = { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
      } catch (e) {
        res = { content: [{ type: 'text', text: String(e?.message || e) }], isError: true };
      }
    } else {
      return isRequest ? fail(id, -32601, `method not found: ${method}`) : null;
    }
    return isRequest ? ok(id, res) : null; // a notification (no id) gets no reply even for known methods
  } catch (e) {
    return isRequest ? fail(id, -32603, `internal error: ${e?.message || e}`) : null;
  }
}

async function main() {
  const catalog = await loadCatalog();
  const send = (msg) => { if (msg) process.stdout.write(`${JSON.stringify(msg)}\n`); };

  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) handleLine(line);
    }
  });
  process.stdin.on('end', () => process.exit(0));

  async function handleLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return send(fail(null, -32700, 'parse error: messages must be newline-delimited JSON'));
    }
    return send(await dispatch(catalog, msg));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    process.stderr.write(`atlas-mcp failed to start: ${e?.message || e}\n`);
    process.exit(1);
  });
}
