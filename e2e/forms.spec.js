import { test, expect } from '@playwright/test';
async function ready(page) {
  await page.goto('/'); await expect(page.locator('#global-count')).not.toHaveText('0');
  if (await page.locator('#welcome-skip').isVisible()) await page.locator('#welcome-skip').click();
}
test('filter errors explain invalid years, preserve applied scope and clear on reset', async ({ page }) => {
  await ready(page);
  await page.locator('#filter-start').fill('2020'); await page.locator('#filter-start').blur();
  await expect(page).toHaveURL(/startYear=2020/);
  await page.locator('#filter-end').fill('2010'); await page.locator('#filter-end').blur();
  await expect(page.locator('#filter-end')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#filter-end-error')).toContainText('same as or later');
  await expect(page.locator('#filter-end')).toHaveAttribute('aria-describedby', 'filter-end-error');
  await expect(page).not.toHaveURL(/endYear=2010/);
  await page.locator('#reset-filters').click();
  await expect(page.locator('#filter-end')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#filter-end-error')).toBeHidden();
  await expect(page.locator('#license-slider')).toHaveAttribute('aria-valuetext', 'any');
});
test('workbench validation blocks stale exports and links helper text to controls', async ({ page }) => {
  await ready(page); await page.locator('#workbench-btn').click();
  await expect(page.locator('#fit-variables')).toHaveAttribute('aria-describedby', 'fit-variables-help');
  await page.locator('#fit-start').fill('2200'); await page.locator('#fit-start').blur();
  await expect(page.locator('#fit-start-error')).toContainText('1800 to 2100');
  await page.locator('#project-json').click(); await expect(page.locator('#fit-start')).toBeFocused();
  await page.locator('#fit-start').fill('2000'); await page.locator('#fit-start').blur();
  await expect(page.locator('#fit-start-error')).toHaveCount(0);
  await page.locator('#project-import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(page.locator('#project-import-error')).toContainText('valid Atlas project JSON');
  await expect(page.locator('#project-import')).toHaveAttribute('aria-invalid', 'true');
});
test('local explorer file errors recover and numeric feedback follows its custom dropdown', async ({ page }) => {
  await ready(page); await page.locator('#explorer-btn').click();
  await page.locator('#explorer-file').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('a,a\n1,2') });
  await expect(page.locator('#explorer-file-error')).toBeVisible();
  await expect(page.locator('#data-explorer')).not.toHaveAttribute('aria-busy', 'true');
  await page.locator('#explorer-file').setInputFiles({ name: 'good.csv', mimeType: 'text/csv', buffer: Buffer.from('year,value\n2020,2\n2021,4') });
  await expect(page.locator('#explorer-status')).toContainText('2 of 2');
  await expect(page.locator('#explorer-file-error')).toBeHidden();
  await page.locator('#explorer-min').fill('3');
  const column = page.locator('[data-select="explorer-filter-column"]');
  await expect(column).toHaveAttribute('aria-invalid', 'true');
  await expect(column).toHaveAttribute('aria-describedby', 'explorer-filter-column-error');
  await expect(page.locator('#explorer-export')).toBeDisabled();
  await column.click(); await page.getByRole('option', { name: 'value', exact: true }).click();
  await expect(page.locator('#explorer-export')).toBeEnabled();
  await expect(column).toHaveAttribute('aria-invalid', 'false');
});
