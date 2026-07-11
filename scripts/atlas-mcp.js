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
 *   list_bundles     the curated "I want to…" starter bundles
 *   build_passport   reproducible download manifest + BibTeX + share link
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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCatalog } from '../js/catalog.js';
import { filterCatalog } from '../js/filters.js';
import { dnaMetrics } from '../js/dna.js';
import { manifestText } from '../js/manifest.js';
import { bibliographyFor } from '../js/citation.js';
import {
  DOMAIN_META, REGION_META, SOURCE_TYPE_META, GLOBAL_REGION, PRESETS, FORMAT_ORDER,
} from '../js/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_BASE = 'https://santoshshinde2012.github.io/dataset-atlas/';
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
  url: d.url,
  ...(d.kaggleRef ? { kaggleRef: d.kaggleRef } : {}),
  formats: d.formats,
  license: d.license,
  licenseOpenness: d.licenseOpenness,
  freshnessYear: d.freshnessYear,
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
  const q = String(query).toLowerCase().slice(0, 80);
  if (q) list = list.filter((d) => `${d.title} ${d.description} ${d.source}`.toLowerCase().includes(q));
  if (region) list = list.filter((d) => d.region === region || (includeGlobal && d.region === GLOBAL_REGION));
  if (maxSizeMB) list = list.filter((d) => d.approxSizeMB <= +maxSizeMB);

  const iso = country ? String(country).toUpperCase() : null;
  const isMatch = (d) => !!iso && (d.countries || []).includes(iso);
  const dnaMean = (d) => dnaMetrics(d).reduce((s, m) => s + m.value, 0) / 5;
  const score = (d) => (isMatch(d) ? 2 : 0)
    + (q && d.title.toLowerCase().includes(q) ? 1 : 0)
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
    results: list.slice(0, n).map((d) => compact(d, iso ? { countryMatch: isMatch(d) } : {})),
  };
}

export function getDataset(catalog, args = {}) {
  const d = catalog.find((x) => x.id === args.id);
  if (!d) throw new Error(`no dataset with id "${args.id}" — ids come from search_catalog / list_bundles`);
  return {
    ...compact(d),
    description: d.description,
    dnaDetail: dnaMetrics(d).map((m) => ({ metric: m.label, value: Math.round(m.value * 100) / 100, note: m.tip })),
    download: d.kaggleRef
      ? `kaggle datasets download -d ${d.kaggleRef}`
      : 'open the url (deep link to the dataset page) — or include it in build_passport for an annotated manifest',
    share_url: shareUrl([d.id]),
  };
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
      description: 'Search the verified dataset catalog with facets and ranking. Returns compact entries with per-dataset DNA scores (frs freshness, cov coverage span, grn granularity, siz size, lic license openness — each 0-1). Pass country (ISO alpha-2) to rank country-tagged datasets first (countryMatch). Regional queries include global datasets unless includeGlobal=false.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'substring match over title/description/source' },
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
      name: 'list_bundles',
      description: 'The curated "I want to…" starter bundles — expert-picked 5-dataset kits per use case (crop yields, disease outbreaks, climate risk, economic modeling, energy transition). Use their dataset ids directly in build_passport.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'build_passport',
      description: 'Turn a list of dataset ids into the three reproducible artifacts: data-passport.sh (runnable, shell-injection-hardened download manifest), references.bib (BibTeX with license + coverage provenance), and a share link that opens the atlas with the collection pre-pinned.',
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
    case 'list_bundles': return listBundles(catalog);
    case 'build_passport': return buildPassport(catalog, args, today);
    default: throw new Error(`unknown tool "${name}"`);
  }
}

/* ---------- stdio JSON-RPC 2.0 transport ---------- */

const INSTRUCTIONS = 'Dataset discovery over a curated, adversarially verified, daily-refreshed catalog. '
  + 'Typical flow: search_catalog (facets: domain/region/country/license/format) or list_bundles for a curated starting kit -> '
  + 'get_dataset to inspect candidates -> build_passport with the chosen ids for a reproducible download script, citations, and a share link. '
  + 'Downloading and profiling the actual data files is the client agent\'s job (kaggle CLI for kaggleRef entries, the url for the rest).';

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
