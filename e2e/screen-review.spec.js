import { test, expect } from '@playwright/test';
async function ready(page) {
  await page.goto('/'); await expect(page.locator('#global-count')).not.toHaveText('0');
  if (await page.locator('#welcome-skip').isVisible()) await page.locator('#welcome-skip').click();
}
test('filter-only results dismiss without discarding requirements and reopen after an edit', async ({ page }) => {
  await ready(page);
  await page.locator('#filter-country').selectOption('IN');
  await expect(page.locator('#card-rail')).toBeVisible();
  await page.locator('#rail-close').click();
  await expect(page.locator('#card-rail')).toBeHidden();
  await expect(page.locator('#filter-country')).toHaveValue('IN');
  await page.locator('#filter-start').fill('2010'); await page.locator('#filter-start').blur();
  await expect(page.locator('#card-rail')).toBeVisible();
  await page.locator('#rail-close').focus(); await page.keyboard.press('Escape');
  await expect(page.locator('#card-rail')).toBeHidden();
});
test('Passport owns the right panel and returns keyboard focus to its opener', async ({ page }) => {
  await ready(page); await page.locator('#search-input').fill('population');
  await page.locator('#passport-btn').click();
  await expect(page.locator('#passport-drawer')).toBeVisible();
  await expect(page.locator('#card-rail')).toBeHidden();
  await expect(page.locator('#passport-close')).toBeFocused();
  await expect(page.locator('#passport-json')).toBeDisabled();
  await page.locator('#passport-close').click();
  await expect(page.locator('#passport-btn')).toBeFocused();
  await expect(page.locator('#card-rail')).toBeVisible();
});
test('About dialog traps keyboard focus, supports Escape and can reopen', async ({ page }) => {
  await ready(page); await page.locator('#about-link').click();
  const dialog = page.locator('#about-panel'); await expect(dialog).toBeVisible();
  await dialog.locator('a').last().focus(); await page.keyboard.press('Tab');
  await expect(page.locator('#about-close')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await expect(page.locator('#about-link')).toBeFocused();
  await page.locator('#about-link').click(); await expect(dialog).toBeVisible();
  await page.locator('#about-close').click(); await expect(dialog).not.toBeVisible();
});

test('mobile comparisons remain reachable while the results sheet is open', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 }); await ready(page);
  await page.locator('#global-pill').click();
  await page.locator('#card-list .compare-btn').nth(0).click();
  await page.locator('#card-list .compare-btn').nth(1).click();
  await expect(page.locator('#results-compare-count')).toHaveText('2');
  await page.locator('#results-compare').click(); await expect(page.locator('#compare-modal')).toBeVisible();
  await page.locator('#compare-close').click(); await expect(page.locator('#results-compare')).toBeFocused();
});
