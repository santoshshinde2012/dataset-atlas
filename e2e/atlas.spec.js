import { test, expect } from '@playwright/test';

test('loads the map and opens a regional dataset rail', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot-fallback')).toBeHidden();
  await expect(page.locator('#global-count')).not.toHaveText('0');
  await page.locator('#global-pill').click();
  await expect(page.locator('#card-rail')).toBeVisible();
  await expect(page.locator('#card-list .card').first()).toBeVisible();
});

test('author credit publishes GitHub, LinkedIn, and Medium with rel=me', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#global-count')).not.toHaveText('0');
  const credit = page.locator('.author-credit-inline a');
  await expect(credit).toHaveCount(3);
  await expect(credit.nth(0)).toHaveAttribute('href', 'https://github.com/santoshshinde2012');
  await expect(credit.nth(1)).toHaveAttribute('href', 'https://www.linkedin.com/in/shindesantosh');
  await expect(credit.nth(2)).toHaveAttribute('href', 'https://medium.com/@santosh-shinde');
  await expect(credit.nth(0)).toHaveAttribute('target', '_blank');
  await expect(credit.nth(0)).toHaveAttribute('rel', /(?:^|\s)me(?:\s|$)/);
  await expect(credit.nth(0)).toHaveAttribute('rel', /noopener/);
  await expect(page.locator('#author-credit a')).toHaveCount(3);
  await expect(page.locator('.author-credit-inline')).toBeInViewport();
  await expect(page.locator('.author-credit-inline a').first()).toBeInViewport();
  await expect(page.locator('.author-credit-inline')).toContainText('Santosh Shinde');
});

test('searches the catalog and restores a shared view', async ({ page }) => {
  await page.goto('/#d=health&r=global');
  await expect(page.locator('#card-rail')).toBeVisible();
  await expect(page.locator('#rail-region-name')).toContainText('Global');
  await page.locator('#rail-close').click();
  await page.locator('#search-input').fill('malaria');
  await expect(page.locator('#rail-region-name')).toContainText('Search results');
  await expect(page.locator('#card-list .card').first()).toBeVisible();
  await page.locator('#external-catalogs-section summary').click();
  await expect(page.locator('#external-catalogs a')).toHaveCount(6);
  await expect(page.locator('#external-catalogs a').first()).toHaveAttribute('href', /q=malaria/);
});

test('word-order-independent search finds known datasets', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#global-count')).not.toHaveText('0');
  await page.locator('#search-input').fill('India crop production');
  await expect(page.locator('#card-list .card')).toHaveCount(2);
  await expect(page.locator('#card-list')).toContainText('Crop Production in India');
});

test('the deploy package omits repository-only files', async ({ request }) => {
  for (const path of ['/README.md', '/scripts/atlas-mcp.js', '/js/catalog-metadata.js', '/js/lib.js']) {
    expect((await request.get(path)).status()).toBe(404);
  }
  for (const path of ['/vendor/d3.LICENSE', '/vendor/topojson-client.LICENSE', '/sitemap.xml', '/robots.txt']) {
    expect((await request.get(path)).status()).toBe(200);
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/dataset/');
  const first = sitemap.match(/dataset\/(d[a-z0-9]+)\.html/)[1];
  expect((await request.get(`/dataset/${first}.html`)).status()).toBe(200);
});

test('pins a dataset and exports the passport manifest', async ({ page }) => {
  await page.goto('/#r=global');
  const firstCard = page.locator('#card-list .card').first();
  await expect(firstCard).toBeVisible();
  await firstCard.locator('.pin-btn').click();
  await page.locator('#passport-btn').click();
  await expect(page.locator('#passport-drawer')).toBeVisible();
  await expect(page.locator('#passport-list .passport-item')).toHaveCount(1);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#passport-export').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('data-passport.sh');
});

test('research workbench checks fit and exports evidence-backed handoff', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#global-count')).not.toHaveText('0');
  await page.locator('#workbench-btn').click();
  await expect(page.locator('.workbench-card')).toHaveCount(5);
  await page.locator('#fit-country').fill('US');
  await page.locator('#fit-country').blur();
  await expect(page.locator('.workbench-card').first()).toContainText('outside documented coverage');
  await expect(page.locator('#join-result')).toContainText('Shared named keys');
  await page.locator('#workbench-task').selectOption('energy');
  await expect(page.locator('.workbench-card')).toHaveCount(5);
  await page.locator('#join-a').selectOption('0');
  await page.locator('#join-b').selectOption('1');
  await expect(page.locator('#join-result')).toContainText('Verified pilot pair');
  const briefEvent = page.waitForEvent('download');
  await page.locator('#workbench-export').click();
  expect((await briefEvent).suggestedFilename()).toBe('dataset-atlas-energy-brief.md');
  const notebookEvent = page.waitForEvent('download');
  await page.getByText(/Download Energy use vs/).click();
  expect((await notebookEvent).suggestedFilename()).toBe('energy-co2-example.ipynb');
  await page.locator('#workbench-task').selectOption('air');
  await expect(page.locator('#join-result')).toContainText('Do not join');
  await expect(page.locator('.workbench-donot')).toContainText('Do not average stations');
  await page.locator('#workbench-task').selectOption('units');
  await expect(page.locator('#join-result')).toContainText('Do not join');
  await page.locator('#workbench-task').selectOption('climate');
  await expect(page.locator('#join-result')).toContainText('Do not join');
});

test('mobile actions fit and the workbench contains keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.locator('#global-count')).not.toHaveText('0');
  for (const id of ['#proj-globe', '#proj-flat', '#theme-toggle', '#workbench-btn', '#passport-btn']) {
    const box = await page.locator(id).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  const credit = await page.locator('#author-credit a').first().boundingBox();
  expect(credit).toBeTruthy();
  expect(credit.x).toBeGreaterThanOrEqual(0);
  expect(credit.x + credit.width).toBeLessThanOrEqual(320);
  await page.locator('#workbench-btn').click();
  await expect(page.locator('#workbench')).toHaveAttribute('open', '');
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('#workbench').contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#workbench')).not.toHaveAttribute('open', '');
  await expect(page.locator('#workbench-btn')).toBeFocused();
});
