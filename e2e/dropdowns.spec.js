import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#global-count')).not.toHaveText('0');
  if (await page.locator('#welcome-skip').isVisible()) await page.locator('#welcome-skip').click();
  await expect(page.locator('[data-select="filter-country"]')).toBeVisible();
}

test('searchable country dropdown selects, restores, resets and dismisses without clearing search', async ({ page }) => {
  await ready(page);
  const country = page.locator('[data-select="filter-country"]');
  await country.click();
  const popup = page.locator('.dropdown-popup:popover-open');
  await popup.getByRole('searchbox').fill('India');
  await expect(popup.getByRole('option')).toHaveCount(1);
  await popup.getByRole('searchbox').press('Enter');
  await expect(country).toHaveText('India');
  await expect(country).toBeFocused();
  await expect(page.locator('#active-filter-chips')).toContainText('India');
  await expect(page).toHaveURL(/country=IN/);
  await page.reload();
  await expect(country).toHaveText('India');
  await page.getByRole('button', { name: 'Remove India filter' }).click();
  await expect(country).toHaveText('Any country');
  await page.locator('#search-input').fill('population');
  await country.click(); await popup.getByRole('searchbox').fill('zzzzzz');
  await expect(popup).toContainText('No matching options');
  await popup.getByRole('searchbox').press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(page.locator('#search-input')).toHaveValue('population');
  await country.click(); await page.locator('.filter-heading').click();
  await expect(popup).toHaveCount(0);
  await page.locator('#reset-filters').click();
  await expect(page.locator('#active-filter-count')).toBeHidden();
});

test('short dropdown keyboard navigation, typeahead and tab keep form focus predictable', async ({ page }) => {
  await ready(page);
  const level = page.locator('[data-select="filter-level"]');
  await level.focus(); await level.press('ArrowDown');
  const list = page.getByRole('listbox', { name: 'Geographic level', exact: true });
  await expect(list).toBeFocused();
  await list.press('End'); await list.press('Enter');
  await expect(level).toHaveText('grid'); await expect(level).toBeFocused();
  await level.press('ArrowDown'); await list.press('Home'); await list.press('ArrowDown'); await list.press('Enter');
  await expect(level).toHaveText('country');
  await level.click(); await list.press('d'); await list.press('Enter');
  await expect(level).toHaveText('district');
  await level.click(); await list.press('Tab');
  await expect(page.locator('#advanced-filters > summary')).toBeFocused();
  await expect(page.locator('.dropdown-popup:popover-open')).toHaveCount(0);
});

test('shared dropdown works inside rerendered modal forms and closes with the modal', async ({ page }) => {
  await ready(page);
  await page.locator('#workbench-btn').click();
  const task = page.locator('[data-select="workbench-task"]');
  await expect(task).toBeVisible(); await task.click();
  const popup = page.locator('.dropdown-popup:popover-open');
  await popup.getByRole('option').filter({ hasText: 'Custom research' }).click();
  await expect(page.locator('#workbench-task')).toHaveValue('custom');
  await expect(task).toHaveText('Custom research');
  await task.click(); await popup.getByRole('listbox').press('Escape');
  await expect(page.locator('#workbench')).toBeVisible();
  await expect(task).toBeFocused();
  await task.click(); await page.locator('#workbench-close').click();
  await expect(popup).toHaveCount(0);
  await expect(page.locator('#workbench')).not.toBeVisible();
});

test('mobile and dark dropdowns stay inside the viewport and beyond panel clipping', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/'); await expect(page.locator('#global-count')).not.toHaveText('0');
  if (await page.locator('#welcome-skip').isVisible()) await page.locator('#welcome-skip').click();
  await page.locator('#rail-expand').click();
  const country = page.locator('[data-select="filter-country"]');
  await country.click();
  const popup = page.locator('.dropdown-popup:popover-open');
  const box = await popup.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(700);
  await popup.getByRole('searchbox').fill('India'); await popup.getByRole('option').click();
  await expect(country).toHaveText('India');
  await page.locator('#rail-collapse').click(); await page.locator('#theme-toggle').click();
  await page.locator('#rail-expand').click(); await country.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await popup.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(13, 20, 36)');
  await popup.getByRole('searchbox').press('Escape');
  expect(await page.locator('#left-rail').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('workbench country names, grouped guidance and fixed header work on mobile', async ({ page }) => {
  await ready(page);
  await page.locator('#workbench-btn').click();
  const country = page.locator('[data-select="fit-country"]');
  await country.click();
  const popup = page.locator('.dropdown-popup:popover-open');
  await popup.getByRole('searchbox').fill('United States');
  await popup.getByRole('option', { name: 'United States', exact: true }).click();
  await expect(page.locator('#fit-country')).toHaveValue('US');
  await expect(country).toHaveText('United States');
  await expect(country).toBeFocused();
  await page.locator('.workbench-guidance > summary').click();
  await expect(page.locator('.workbench-guidance')).toContainText('Do not join crop and rainfall on district name');
  await page.setViewportSize({ width: 320, height: 700 });
  await page.locator('#project-python').scrollIntoViewIfNeeded();
  await expect(page.locator('#workbench-close')).toBeInViewport();
  expect(await page.locator('#workbench-body').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator('#workbench-close').click();
  await expect(page.locator('#workbench-btn')).toBeFocused();
});

test('workspace navigation and live overview track included sources', async ({ page }) => {
  await ready(page); await page.locator('#workbench-btn').click();
  await expect(page.locator('#summary-included')).toHaveText('5');
  await page.locator('.workspace-nav [data-step="project-sources-title"]').click();
  await expect(page.locator('#project-sources-title')).toBeFocused();
  await page.locator('.workbench-select').first().uncheck();
  await expect(page.locator('#summary-included')).toHaveText('4');
  await page.locator('.workspace-summary [data-step="pair-title"]').click();
  await expect(page.locator('#pair-title')).toBeFocused();
  await page.locator('.workspace-nav [data-step="handoff-title"]').click();
  await expect(page.locator('#workbench-export')).toBeInViewport();
  await page.locator('.workspace-nav [data-step="research-setup-title"]').click();
  await page.locator('#project-name').fill('Climate study'); await page.locator('#project-name').blur();
  await expect(page.locator('.workspace-summary h3')).toHaveText('Climate study');
});

test('mobile workspace puts project transfers behind a keyboard-accessible disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/'); await expect(page.locator('#global-count')).not.toHaveText('0');
  if (await page.locator('#welcome-skip').isVisible()) await page.locator('#welcome-skip').click();
  await page.locator('#workbench-btn').click();
  await expect(page.locator('#project-share')).toBeHidden();
  await expect(page.locator('[data-select="workbench-task"]')).toBeInViewport();
  await page.locator('.project-options > summary').focus(); await page.locator('.project-options > summary').press('Enter');
  await expect(page.locator('#project-share')).toBeVisible();
  await page.locator('.workspace-nav [data-step="pair-title"]').click();
  await expect(page.locator('#pair-title')).toBeFocused();
  expect(await page.locator('#workbench-body').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});
