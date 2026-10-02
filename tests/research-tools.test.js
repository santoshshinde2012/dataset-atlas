import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalog } from '../js/catalog.js';
import { withProfiles } from '../js/dataset.js';
import { parseQuery, searchScore, searchExplanation } from '../js/search.js';
import { matchesFacets } from '../js/filters.js';
import { parseState, serializeState } from '../js/url-state.js';
import { createStore } from '../js/store.js';
import { normalizeProject, encodeProject, decodeProject } from '../js/project.js';
import { inventory, inventoryCsv, pythonRecipe } from '../js/exports.js';
import { parseDelimited, profileTable, filterRows, tableCsv } from '../js/data-table.js';
import { SOURCE_TYPE_META } from '../js/config.js';
import { searchCatalog, buildPassport } from '../scripts/atlas-mcp.js';
import { spawnSync } from 'node:child_process';

const raw = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url)));
const pilot = JSON.parse(readFileSync(new URL('../data/pilot.json', import.meta.url)));
const catalog = withProfiles(buildCatalog(raw), pilot.profiles);
const population = catalog.find((d) => /Population, total/.test(d.title));
const defaults = { domain: 'all', sourceTypes: new Set(Object.keys(SOURCE_TYPE_META)), formats: new Set(['CSV', 'API', 'JSON', 'XLSX', 'Raster', 'Geo', 'Other']), minOpenness: 0, search: '' };

test('country phrases, aliases and date ranges find relevant global series', () => {
  for (const query of ['India population 2010 2023', 'UK population', 'United Kingdom population', 'IN population']) assert.ok(searchScore(population, query) > 0, query);
  assert.equal(parseQuery('population in Europe').country, null);
  assert.equal(parseQuery('South Korea population').country, 'KR');
  assert.equal(parseQuery('population from 2010 through 2023').startYear, 2010);
  assert.equal(searchScore(population, 'population 1800 1801'), 0);
  assert.ok(searchExplanation(population, 'UK population').some((r) => r.includes('candidate')));
});

test('country names in titles and descriptions match without country tags', () => {
  const dataset = { title: 'United Kingdom population', description: '', source: '', countries: [], coverageStart: 2000, coverageEnd: 2023 };
  assert.equal(searchScore(dataset, 'UK population'), 10);
  assert.equal(searchScore({ ...dataset, title: 'Population', description: 'United Kingdom estimates' }, 'UK population'), 7);
  assert.equal(searchScore({ ...dataset, title: 'Population', description: 'United estimates' }, 'UK population'), 0);
});

test('reviewed column search is available in browser discovery without inventing fields', () => {
  const station = catalog.find((d) => /openaq/i.test(d.url));
  assert.ok(searchScore(station, 'station_id') > 0);
  assert.equal(searchScore(station, 'invented_air_column'), 0);
  assert.ok(catalog.some((d) => searchScore(d, 'rainfall India district') > 0));
});

test('observed country dates and confirmed absence narrow query results', () => {
  const index = { series: { [population.url]: { GB: [2000, 2005] } } };
  assert.equal(searchScore(population, 'UK population 2010 2023', { coverageIndex: index }), 0);
  assert.equal(searchScore(population, 'India population', { coverageIndex: index }), 0);
});

test('practical filters distinguish candidates, tags, observed rows and resource types', () => {
  const coverageIndex = { series: { [population.url]: { IN: [2010, 2020] } } };
  assert.ok(matchesFacets(population, { ...defaults, country: 'IN', coverageMode: 'observed', coverageIndex, startYear: 2015, resourceKind: 'download' }));
  assert.equal(matchesFacets(population, { ...defaults, country: 'IN', coverageMode: 'observed', coverageIndex, startYear: 2021 }), false);
  assert.equal(matchesFacets(population, { ...defaults, country: 'IN', coverageMode: 'documented' }), false);
  assert.equal(matchesFacets(population, { ...defaults, search: '1800 1801' }), false);
  const unknown = { ...population, license: 'Unknown', licenseOpenness: 1 };
  assert.equal(matchesFacets(unknown, { ...defaults, reuse: 'redistribute' }), false);
});

test('filter-only discovery opens results and filter links round-trip', () => {
  const store = createStore({ catalog, pinStorage: { load: () => [], save: () => {} } });
  store.actions.setPracticalFilters({ country: 'GB', startYear: 2010, endYear: 2023, resourceKind: 'download', level: 'country', reuse: 'analysis', coverageMode: 'observed' });
  assert.equal(store.select.railMode(), 'search');
  const parsed = parseState(serializeState(store.getState(), store.select.allFormats()));
  assert.equal(parsed.country, 'GB'); assert.equal(parsed.startYear, 2010); assert.equal(parsed.resourceKind, 'download');
  store.actions.resetFilters(); assert.equal(store.getState().country, ''); assert.equal(store.select.railMode(), null);
  assert.equal(parseState('#startYear=NaN&endYear=9999').startYear, null);
});

test('project sharing preserves requirements, exclusions and pair selection, including Unicode', () => {
  const raw = { name: 'CO₂ research 🌍', task: pilot.tasks[2], sourceIds: [population.id, 'dmissing'], includedIds: [], pairIds: [population.id] };
  const p = normalizeProject(raw, catalog, pilot.tasks);
  assert.deepEqual(p.sourceIds, [population.id]);
  assert.deepEqual(decodeProject(encodeProject(p), catalog, pilot.tasks), p);
  assert.equal(decodeProject('broken<script>', catalog, pilot.tasks), null);
  assert.equal(normalizeProject({ ...raw, task: { ...raw.task, startYear: 2050, endYear: 2000 } }, catalog, pilot.tasks), null);
});

test('inventory preserves selected distributions and inferred research scope', () => {
  const api = population.resources.find((r) => r.kind === 'api');
  const data = inventory([population], { search: 'India population 2010 2023', coverageIndex: { series: {} } }, { [population.id]: api.url });
  assert.equal(data.requirements.country, 'IN'); assert.equal(data.requirements.startYear, 2010);
  assert.equal(data.requirements.coverageIndex, undefined); assert.equal(data.datasets[0].selectedResource.url, api.url);
  assert.ok(inventoryCsv([{ ...population, title: '=HYPERLINK("evil")' }]).includes("'=HYPERLINK"));
});

test('generated Python recipes compile and paginate World Bank with scoped requirements', () => {
  const api = population.resources.find((r) => r.kind === 'api');
  const code = pythonRecipe([population], { country: 'IN', startYear: 2010, endYear: 2023 }, { [population.id]: api.url });
  const compile = spawnSync('python3', ['-c', 'import sys; compile(sys.stdin.read(), "recipe.py", "exec")'], { input: code, encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr);
  assert.ok(code.includes('while page <= pages:')); assert.ok(code.includes('sha256'));
});

test('CSV handles multiline quotes, escaped fields, missing cells and exact export round trips', () => {
  const table = parseDelimited('name,value,note\r\n"A, B",1,"line one\nline ""two"""\r\nC,,\r\nD,3\r\n');
  assert.deepEqual(table.rows[0], ['A, B', '1', 'line one\nline "two"']);
  assert.deepEqual(table.rows[2], ['D', '3', '']);
  assert.deepEqual(parseDelimited(tableCsv(table)), table);
  assert.equal(profileTable(table)[1].missing, 1);
  assert.deepEqual(filterRows(table, { column: 1, min: 2 }), [table.rows[2]]);
  assert.throws(() => parseDelimited('a,a\n1,2'), /unique/);
  assert.throws(() => parseDelimited('a,b\n"oops'), /Unclosed/);
});

test('MCP exposes practical filters and machine-readable exports', () => {
  const result = searchCatalog(catalog, { query: 'UK population 2010 2023', resourceKind: 'download' });
  assert.ok(result.total > 0);
  const passport = buildPassport(catalog, { ids: [population.id], requirements: { country: 'IN', startYear: 2010, endYear: 2020 } });
  assert.equal(passport.inventory_json.requirements.country, 'IN'); assert.ok(passport.download_py.includes('urllib.request')); assert.ok(passport.inventory_csv.includes('resourceUrl'));
});

test('Python recipes retrieve all scoped API pages and write reproducibility records', () => {
  const api = population.resources.find((r) => r.kind === 'api');
  const recipe = pythonRecipe([{ ...population, title: 'A "quoted" title; harmless \\ string' }], { country: 'IN', startYear: 2010, endYear: 2011 }, { [population.id]: api.url });
  const harness = `import sys, json, tempfile, os, urllib.request, urllib.parse, pathlib, csv, hashlib
recipe = sys.stdin.read()
calls = []
class Response:
    headers = {"Content-Type": "application/json"}
    def __init__(self, data): self.data = data
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit): return self.data
def mock(req, timeout):
    q = urllib.parse.parse_qs(urllib.parse.urlsplit(req.full_url).query)
    assert '/country/IN/indicator/' in req.full_url
    assert q['date'] == ['2010:2011']
    page = int(q['page'][0]); calls.append(page)
    return Response(json.dumps([{'pages': 2}, [{'countryiso3code': 'IND', 'country': {'value': 'India'}, 'date': str(2009 + page), 'value': 100 + page, 'unit': 'people'}]]).encode())
urllib.request.urlopen = mock
with tempfile.TemporaryDirectory() as folder:
    os.chdir(folder)
    exec(compile(recipe, 'recipe.py', 'exec'), {})
    assert calls == [1, 2], calls
    provenance = json.loads(pathlib.Path('atlas-data/provenance.json').read_text())
    record = provenance['datasets'][0]['download']
    raw = pathlib.Path(record['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == record['sha256']
    rows = list(csv.DictReader(raw.decode().splitlines()))
    assert len(rows) == 2 and rows[1]['year'] == '2011', rows
`;
  const run = spawnSync('python3', ['-c', harness], { input: recipe, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('OWID Python extracts filter ISO/year rows and preserve source and output checksums', () => {
  const energy = catalog.find((d) => d.url === 'https://github.com/owid/energy-data');
  const recipe = pythonRecipe([energy], { country: 'IN', startYear: 2010, endYear: 2011 });
  const harness = `import sys, tempfile, os, urllib.request, pathlib, json, csv
recipe = sys.stdin.read()
class Response:
    headers = {'Content-Type': 'text/csv'}
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit): return b'iso_code,year,energy\\nIND,2009,1\\nIND,2010,2\\nGBR,2010,3\\nOWID_WRL,2010,4\\nIND,2011,5\\n'
urllib.request.urlopen = lambda *args, **kwargs: Response()
with tempfile.TemporaryDirectory() as folder:
    os.chdir(folder)
    exec(compile(recipe, 'recipe.py', 'exec'), {})
    p = json.loads(pathlib.Path('atlas-data/provenance.json').read_text())['datasets'][0]
    rows = list(csv.DictReader(pathlib.Path(p['download']['file']).read_text().splitlines()))
    assert len(rows) == 2 and all(r['iso_code'] == 'IND' for r in rows)
    assert p['extractRows'] == 2
    assert p['sourceDownload']['sha256'] != p['download']['sha256']
    assert p['download']['downloadedAt']
`;
  const run = spawnSync('python3', ['-c', harness], { input: recipe, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('shared year validation supports optional and required ranges without coercing invalid dates', async () => {
  const { yearRangeErrors } = await import('../js/requirements.js');
  assert.deepEqual(yearRangeErrors('', ''), {});
  assert.deepEqual(yearRangeErrors(null, null), {});
  assert.ok(yearRangeErrors('', '', { required: true }).startYear);
  assert.ok(yearRangeErrors('2010.5', '2020').startYear);
  assert.ok(yearRangeErrors('2200', '2020').startYear);
  assert.ok(yearRangeErrors('2020', '2010').endYear);
  assert.deepEqual(yearRangeErrors('2020', '2020', { required: true }), {});
});
