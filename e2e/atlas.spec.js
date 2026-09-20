import { test, expect } from '@playwright/test';

test('loads the map and opens a regional dataset rail', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot-fallback')).toBeHidden();
  await expect(page.locator('#global-count')).not.toHaveText('0');
  await page.locator('#global-pill').click();
  await expect(page.locator('#card-rail')).toBeVisible();
  await expect(page.locator('#card-list .card').first()).toBeVisible();
});

test('searches the catalog and restores a shared view', async ({ page }) => {
  await page.goto('/#d=health&r=global');
  await expect(page.locator('#card-rail')).toBeVisible();
  await expect(page.locator('#rail-region-name')).toContainText('Global');
  await page.locator('#rail-close').click();
  await page.locator('#search-input').fill('malaria');
  await expect(page.locator('#rail-region-name')).toContainText('Search results');
  await expect(page.locator('#card-list .card').first()).toBeVisible();
});

test('the deploy package omits repository-only files', async ({ request }) => {
  for (const path of ['/README.md', '/scripts/atlas-mcp.js', '/js/catalog-metadata.js']) {
    expect((await request.get(path)).status()).toBe(404);
  }
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
