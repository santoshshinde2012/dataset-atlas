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
