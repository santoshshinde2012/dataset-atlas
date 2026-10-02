import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { encodeProject } from '../js/project.js';
import { readFileSync } from 'node:fs';
import { buildCatalog } from '../js/catalog.js';

const raw = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url)));
const catalog = buildCatalog(raw);
const pilot = JSON.parse(readFileSync(new URL('../data/pilot.json', import.meta.url)));
const population = catalog.find((d) => /Population, total/.test(d.title));
const energy = catalog.find((d) => d.url === 'https://github.com/owid/energy-data');
const co2 = catalog.find((d) => d.url === 'https://github.com/owid/co2-data');
const ready = async (page) => { await page.goto('/'); await expect(page.locator('#global-count')).not.toHaveText('0'); if (await page.locator('#welcome-skip').isVisible()) await page.locator('#welcome-skip').click(); };
const downloadContent = async (page, trigger) => {
  const event = page.waitForEvent('download'); await trigger(); const download = await event;
  return { name: download.suggestedFilename(), text: await readFile(await download.path(), 'utf8') };
};

test('country/year search, reviewed columns, and requirement filters work together', async ({ page }) => {
  await ready(page);
  await page.locator('#search-input').fill('UK population 2010 2023');
  await expect(page.locator('#card-list')).toContainText('Population, total');
  await expect(page.locator('.match-reasons').first()).toContainText('2010–2023');
  await page.locator('#search-input').fill('station_id');
  await expect(page.locator('#card-list')).toContainText('OpenAQ');
  await page.locator('#reset-filters').click();
  await page.locator('#filter-country').selectOption('IN');
  await page.locator('#advanced-filters > summary').click();
  await page.locator('#filter-coverage').selectOption('observed');
  await page.locator('#filter-resource').selectOption('download');
  await page.locator('#filter-start').fill('2010'); await page.locator('#filter-start').blur();
  await page.locator('#filter-end').fill('2023'); await page.locator('#filter-end').blur();
  await expect(page.locator('#card-list .card').first()).toBeVisible();
  await expect(page).toHaveURL(/startYear=2010/);
  await expect(page).toHaveURL(/endYear=2023/);
  await page.reload();
  await expect(page.locator('#filter-country')).toHaveValue('IN');
  await expect(page.locator('#filter-start')).toHaveValue('2010');
  await expect(page.locator('#filter-resource')).toHaveValue('download');
});

test('details select resources and connect to project creation', async ({ page }) => {
  await page.goto(`/#ds=${population.id}`);
  const card = page.locator(`.card[data-id="${population.id}"]`);
  await card.locator('.detail-btn').click();
  const dialog = page.locator('#dataset-detail');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Choose a resource');
  const apiIndex = population.resources.findIndex((r) => r.kind === 'api');
  await page.locator('#detail-resource').selectOption(String(apiIndex));
  await expect(page.locator('#detail-resource-link a')).toHaveText('Open selected API');
  await page.locator('#detail-project').click();
  await expect(page.locator('#workbench')).toBeVisible();
  await expect(page.locator('.workbench-grid')).toContainText(population.title);
});

test('projects retain exclusions and pairs after edits, reload, save and import', async ({ page }) => {
  await ready(page); await page.locator('#workbench-btn').click();
  await page.locator('#workbench-task').selectOption('energy');
  await page.locator('.workbench-select').first().uncheck();
  await page.locator('#join-a').selectOption('1'); await page.locator('#join-b').selectOption('2');
  await page.locator('#fit-start').fill('2005'); await page.locator('#fit-start').blur();
  await expect(page.locator('.workbench-select').first()).not.toBeChecked();
  await expect(page.locator('#join-a')).toHaveValue('1');
  await page.locator('#project-name').fill('Energy research'); await page.locator('#project-name').blur();
  await page.locator('#project-save').click();
  const exported = await downloadContent(page, () => page.locator('#project-json').click());
  expect(JSON.parse(exported.text).task.startYear).toBe(2005);
  await page.reload(); await expect(page.locator('#global-count')).not.toHaveText('0'); await page.locator('#workbench-btn').click();
  await expect(page.locator('#project-name')).toHaveValue('Energy research');
  await expect(page.locator('.workbench-select').first()).not.toBeChecked();
  await expect(page.locator('#join-a')).toHaveValue('1');
  await page.locator('#workbench-task').selectOption('crop');
  await page.locator('#project-import').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(exported.text) });
  await expect(page.locator('#fit-start')).toHaveValue('2005');
  await expect(page.locator('#project-name')).toHaveValue('Energy research');
});

test('shared projects restore requirements and sources without creating pins', async ({ page }) => {
  const project = { name: 'Shared energy project', task: { ...pilot.tasks[2], startYear: 2012 }, sourceIds: [energy.id, co2.id], includedIds: [co2.id], pairIds: [energy.id, co2.id] };
  await page.goto(`/#project=${encodeProject(project)}`);
  await expect(page.locator('#workbench')).toBeVisible();
  await expect(page.locator('#project-name')).toHaveValue(project.name);
  await expect(page.locator('#fit-start')).toHaveValue('2012');
  await expect(page.locator('#passport-count')).toHaveText('0');
  const json = await downloadContent(page, () => page.locator('#project-json').click());
  expect(JSON.parse(json.text).includedIds).toEqual([co2.id]);
});

test('comparison assesses verified pairs and keeps keyboard focus inside', async ({ page }) => {
  await ready(page); await page.locator('#search-input').fill('energy');
  await page.locator(`.card[data-id="${energy.id}"] .compare-btn`).click();
  await page.locator('#search-input').fill('CO2');
  await page.locator(`.card[data-id="${co2.id}"] .compare-btn`).click();
  await page.locator('#compare-tray').click();
  await expect(page.locator('#compare-compatibility')).toContainText('Verified pilot pair');
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => document.querySelector('#compare-modal').contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(page.locator('#compare-modal')).not.toBeVisible();
  await expect(page.locator('#compare-tray')).toBeFocused();
});

test('Passport exports selected resources in JSON, CSV and paginated Python recipes', async ({ page }) => {
  await page.goto(`/#ds=${population.id}`);
  await page.locator(`.card[data-id="${population.id}"] .pin-btn`).click();
  await page.locator('#filter-country').selectOption('IN');
  await page.locator('#passport-btn').click();
  await page.locator('.passport-exports summary').click();
  const json = await downloadContent(page, () => page.locator('#passport-json').click());
  expect(JSON.parse(json.text).datasets[0].selectedResource.kind).toBe('api');
  const csv = await downloadContent(page, () => page.locator('#passport-csv').click());
  expect(csv.text).toContain('Population, total');
  const py = await downloadContent(page, () => page.locator('#passport-python').click());
  expect(py.text).toContain('while page <= pages:');
  const config = JSON.parse(JSON.parse(py.text.match(/CONFIG = json.loads\((.+)\)/)[1]));
  expect(config.requirements.country).toBe('IN');
});

test('local explorer profiles, filters, charts and exports CSV without network requests', async ({ page }) => {
  await ready(page); await page.locator('#explorer-btn').click();
  let requests = 0; page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')) requests++; });
  await page.locator('#explorer-file').setInputFiles({ name: 'sample.csv', mimeType: 'text/csv', buffer: Buffer.from('country,year,value\nIndia,2020,10\nIndia,2021,20\nUK,2020,\n') });
  await expect(page.locator('#explorer-status')).toContainText('3 of 3 rows');
  await page.locator('#explorer-filter').fill('India');
  await expect(page.locator('#explorer-status')).toContainText('2 of 3 rows');
  await page.locator('#explorer-x').selectOption('1'); await page.locator('#explorer-y').selectOption('2');
  await expect(page.locator('#explorer-chart')).toBeVisible();
  await expect(page.locator('#explorer-chart circle')).toHaveCount(2);
  const csv = await downloadContent(page, () => page.locator('#explorer-export').click());
  expect(csv.text).toContain('India'); expect(csv.text).not.toContain('UK');
  expect(requests).toBe(0);
});

test('invalid local files show a recoverable error and mobile tools fit', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 }); await ready(page);
  await page.locator('#rail-expand').click(); await page.locator('#explorer-btn').click();
  await page.locator('#explorer-file').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n"unfinished') });
  await expect(page.locator('#explorer-status')).toContainText('Unclosed');
  const box = await page.locator('#data-explorer').boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape'); await expect(page.locator('#data-explorer')).not.toBeVisible();
});

// Apache parquet-testing alltypes_plain.parquet fixture (Apache-2.0):
// https://github.com/apache/parquet-testing/blob/master/data/alltypes_plain.parquet
// Exercises the actual lazy DuckDB worker and Wasm engine, rather than a mock reader.
test('Parquet files are profiled and exported through the lazy engine', async ({ page }) => {
  test.setTimeout(90000);
  await ready(page); await page.locator('#explorer-btn').click();
  await page.locator('#explorer-file').setInputFiles(new URL('./fixtures/local-sample.parquet', import.meta.url).pathname);
  await expect(page.locator('#explorer-status')).toContainText('8 of 8 rows', { timeout: 60000 });
  await expect(page.locator('#explorer-table')).toContainText('id');
  const csv = await downloadContent(page, () => page.locator('#explorer-export').click());
  expect(csv.text).toContain('bool_col');
});

test('Parquet engine failures allow a subsequent offline CSV import', async ({ page }) => {
  await ready(page); await page.locator('#explorer-btn').click();
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await page.locator('#explorer-file').setInputFiles(new URL('./fixtures/local-sample.parquet', import.meta.url).pathname);
  await expect(page.locator('#explorer-status')).toContainText('Could not read file');
  await page.locator('#explorer-file').setInputFiles({ name: 'recovery.csv', mimeType: 'text/csv', buffer: Buffer.from('year,value\n2020,4\n') });
  await expect(page.locator('#explorer-status')).toContainText('1 of 1 rows');
});

test('numeric filters affect exports immediately and cannot export an invalid range', async ({ page }) => {
  await ready(page); await page.locator('#explorer-btn').click();
  await page.locator('#explorer-file').setInputFiles({ name: 'values.csv', mimeType: 'text/csv', buffer: Buffer.from('year,value\n2020,4\n2021,8\n2022,12\n') });
  await expect(page.locator('#explorer-status')).toContainText('3 of 3 rows');
  await page.locator('#explorer-filter-column').selectOption('1');
  await page.locator('#explorer-min').fill('5');
  const csv = await downloadContent(page, () => page.locator('#explorer-export').click());
  expect(csv.text).not.toContain('2020'); expect(csv.text).toContain('2021');
  await page.locator('#explorer-max').fill('2');
  await expect(page.locator('#explorer-export')).toBeDisabled();
  await expect(page.locator('#explorer-status')).toContainText('Minimum must not exceed maximum');
});
