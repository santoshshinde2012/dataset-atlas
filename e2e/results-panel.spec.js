import { test, expect } from '@playwright/test';
async function ready(page) {
  await page.goto('/'); await expect(page.locator('#global-count')).not.toHaveText('0');
  if (await page.locator('#welcome-skip').isVisible()) await page.locator('#welcome-skip').click();
  await page.locator('#global-pill').click(); await expect(page.locator('#card-list .card').first()).toBeVisible();
}
test('results controls and expandable evidence preserve pin and compare states', async ({ page }) => {
  await ready(page);
  await page.locator('[data-select="sort-select"]').click();
  await page.getByRole('option', { name: 'A – Z', exact: true }).click();
  await expect(page.locator('#sort-select')).toHaveValue('title');
  const card = page.locator('#card-list .card').first();
  await card.locator('.pin-btn').click(); await expect(card.locator('.pin-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('.pin-btn')).toHaveAttribute('aria-label', 'Remove from Data Passport');
  await card.locator('.compare-btn').click(); await expect(card.locator('.compare-btn')).toHaveAttribute('aria-pressed', 'true');
  await card.locator('.card-evidence > summary').focus(); await card.locator('.card-evidence > summary').press('Enter');
  await expect(card.locator('.card-reuse-note')).toBeVisible();
  await card.locator('.dna-bar').first().focus(); await card.locator('.dna-bar').first().press('Enter');
  await expect(page.locator('#toast')).toContainText('Editorial content year');
  await card.locator('.detail-btn').click(); await expect(page.locator('#dataset-detail')).toBeVisible();
});
test('mobile result sheets scroll cards without clipping controls or moving the header', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 }); await ready(page);
  const rail = page.locator('#card-rail');
  expect(await rail.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator('#card-list .card').last().scrollIntoViewIfNeeded();
  await expect(page.locator('#rail-close')).toBeInViewport();
  await expect(page.locator('[data-select="sort-select"]')).toBeInViewport();
  await page.locator('[data-select="sort-select"]').click();
  const popup = page.locator('.dropdown-popup:popover-open'); const box = await popup.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(320);
  await popup.getByRole('option', { name: 'Latest coverage', exact: true }).click();
  await page.locator('#rail-close').click(); await expect(rail).toBeHidden();
});
test('global collection search, domain picker and compact descriptions remain usable', async ({page}) => {
  await ready(page);
  await page.locator('[data-select="results-domain"]').click();
  await page.getByRole('option', {name:/^Climate \(/}).click();
  await expect(page.locator('#rail-region-sub')).toContainText('Climate');
  await page.locator('#results-search').fill('NASA');
  await expect(page.locator('#card-list .card')).toHaveCount(1);
  await expect(page.locator('#results-search')).toBeFocused();
  const card=page.locator('#card-list .card');
  await card.locator('.description-toggle').click();
  await expect(card.locator('.description-toggle')).toHaveAttribute('aria-expanded','true');
  await card.locator('.description-toggle').click();
  await expect(card.locator('.card-desc')).toHaveClass(/description-preview/);
  await card.locator('.pin-btn').click(); await expect(card.locator('.pin-btn')).toHaveAttribute('aria-pressed','true');
  await page.locator('#results-search').fill('');
  await page.locator('[data-select="results-domain"]').click();await page.getByRole('option',{name:/^All domains \(/}).click();
  await expect(page.locator('#card-list .card')).toHaveCount(55);
});
