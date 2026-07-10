#!/usr/bin/env node
/**
 * Dynamic catalog refresh — keeps the atlas current without a backend.
 *
 * 1. Liveness sweep: fetches every catalog URL and classifies it
 *    (ok / blocked-by-bot-wall / dead / transient-error).
 * 2. Freshness enrichment: for hosts with public metadata APIs (CKAN
 *    portals, GitHub, figshare, World Bank), reads the source's own
 *    last-modified date and bumps freshnessYear when the source is newer.
 *    Adapters are a registry — supporting a new host is one entry.
 * 3. Stamps data/catalog.json with a `generated` date (shown in the UI).
 *
 * Run manually (`npm run refresh`) or on a schedule (.github/workflows/
 * refresh.yml, which opens a PR when anything changed). Exits 1 when dead
 * links are found so CI turns red until a human fixes or replaces them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'data/catalog.json');
const data = JSON.parse(readFileSync(path, 'utf8'));
const catalog = data.datasets;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 DatasetAtlasBot/1.0';

async function get(url, timeoutMs = 30000, asJson = false, extraHeaders = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: asJson ? 'application/json' : 'text/html,*/*', ...extraHeaders },
    });
    const body = asJson && res.ok ? await res.json().catch(() => null) : null;
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  } finally {
    clearTimeout(t);
  }
}

/* ---------- 1. liveness ---------- */

function classify(status) {
  if (status === 404 || status === 410) return 'dead';
  if ([401, 402, 403, 405, 406, 429].includes(status)) return 'blocked'; // bot walls — alive for humans
  if (status >= 200 && status < 400) return 'ok';
  return 'transient'; // network error / 5xx — warn, do not fail
}

/* ---------- 2. freshness adapters (host → last-modified year) ---------- */

const CKAN_HOSTS = {
  'data.humdata.org': 'https://data.humdata.org',
  'www.data.qld.gov.au': 'https://www.data.qld.gov.au',
  'data.gov.au': 'https://data.gov.au/data',
  'energydata.info': 'https://energydata.info',
  'data.buenosaires.gob.ar': 'https://data.buenosaires.gob.ar',
};

const ADAPTERS = [
  {
    name: 'ckan',
    match: (u) => CKAN_HOSTS[u.hostname] && /\/dataset\/([^/?#]+)/.exec(u.pathname),
    async year(u, m) {
      const api = `${CKAN_HOSTS[u.hostname]}/api/3/action/package_show?id=${m[1]}`;
      const { body } = await get(api, 30000, true);
      const d = body?.result?.metadata_modified;
      return d ? new Date(d).getFullYear() : null;
    },
  },
  {
    name: 'github',
    match: (u) => u.hostname === 'github.com' && /^\/([\w.-]+)\/([\w.-]+)/.exec(u.pathname),
    async year(u, m) {
      const { body } = await get(`https://api.github.com/repos/${m[1]}/${m[2]}`, 30000, true);
      return body?.pushed_at ? new Date(body.pushed_at).getFullYear() : null;
    },
  },
  {
    name: 'figshare',
    match: (u) => u.hostname.endsWith('figshare.com') && /\/articles\/dataset\/[^/]+\/(\d+)/.exec(u.pathname),
    async year(u, m) {
      const { body } = await get(`https://api.figshare.com/v2/articles/${m[1]}`, 30000, true);
      const d = body?.modified_date || body?.published_date;
      return d ? new Date(d).getFullYear() : null;
    },
  },
  {
    name: 'worldbank-indicator',
    match: (u) => u.hostname === 'data.worldbank.org' && /^\/indicator\//.test(u.pathname),
    async year() {
      // WDI database-level last update (source 2)
      const { body } = await get('https://api.worldbank.org/v2/sources/2?format=json', 30000, true);
      const d = body?.[1]?.[0]?.lastupdated;
      return d ? new Date(d).getFullYear() : null;
    },
  },
  {
    // Phase 2 completion: Kaggle metadata via the official API. Activates only
    // when KAGGLE_USERNAME / KAGGLE_KEY are present (repo secrets in CI, or a
    // local ~/.kaggle token exported to the environment); skips silently
    // otherwise so the refresh stays credential-free by default.
    name: 'kaggle',
    match: (u) => u.hostname === 'www.kaggle.com' && /^\/datasets\/([\w.-]+)\/([\w.-]+)/.exec(u.pathname),
    async year(u, m) {
      const user = process.env.KAGGLE_USERNAME;
      const key = process.env.KAGGLE_KEY;
      if (!user || !key) return null;
      const auth = 'Basic ' + Buffer.from(`${user}:${key}`).toString('base64');
      const { body } = await get(
        `https://www.kaggle.com/api/v1/datasets/view/${m[1]}/${m[2]}`,
        30000, true, { Authorization: auth });
      const d = body?.lastUpdated || body?.lastUpdatedNullable;
      return d ? new Date(d).getFullYear() : null;
    },
  },
];

/* ---------- run ---------- */

const report = { ok: 0, blocked: 0, transient: [], dead: [], bumped: [] };
const today = new Date().toISOString().slice(0, 10);
const queue = [...catalog];
const workers = Array.from({ length: 8 }, async () => {
  for (let d = queue.shift(); d; d = queue.shift()) {
    const { status } = await get(d.url);
    const cls = classify(status);
    if (cls === 'ok') {
      report.ok++;
      d.verified = today; // per-entry provenance stamp shown as a card badge
    } else if (cls === 'blocked') report.blocked++;
    else report[cls === 'dead' ? 'dead' : 'transient'].push(`${status} ${d.title} — ${d.url}`);

    const u = new URL(d.url);
    for (const a of ADAPTERS) {
      const m = a.match(u);
      if (!m) continue;
      const year = await a.year(u, m).catch(() => null);
      if (year && year > d.freshnessYear) {
        report.bumped.push(`${d.title}: freshnessYear ${d.freshnessYear} -> ${year} (${a.name})`);
        d.freshnessYear = year;
        if (year > d.coverageEnd && d.coverageEnd >= 2020) d.coverageEnd = year; // living series keep extending
      }
      break;
    }
  }
});
await Promise.all(workers);

data.generated = new Date().toISOString().slice(0, 10);
writeFileSync(path, JSON.stringify(data, null, 1) + '\n');

console.log(`liveness: ${report.ok} ok, ${report.blocked} bot-blocked, ${report.transient.length} transient, ${report.dead.length} dead`);
for (const l of report.transient) console.warn('  transient:', l);
for (const l of report.dead) console.error('  DEAD:', l);
console.log(`freshness: ${report.bumped.length} entries bumped`);
for (const l of report.bumped) console.log('  ', l);
console.log(`stamped generated=${data.generated}`);

process.exit(report.dead.length ? 1 : 0);
