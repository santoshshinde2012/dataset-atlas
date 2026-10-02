import { test, expect } from '@playwright/test';
async function ready(page) {
  await page.goto('/'); await expect(page.locator('#global-count')).not.toHaveText('0');
  if(await page.locator('#welcome-skip').isVisible())await page.locator('#welcome-skip').click();
}
test('Passport empty state leads to discovery and collection review supports search and undo', async ({page})=>{
  await ready(page);await page.locator('#passport-btn').click();
  await expect(page.locator('.passport-actions')).toBeHidden();
  await page.locator('#passport-discover').click();
  await expect(page.locator('#card-rail')).toBeVisible();
  await page.locator('#card-list .pin-btn').first().click();
  await page.locator('#passport-btn').click();
  await expect(page.locator('.passport-item')).toHaveCount(1);
  await page.locator('#passport-search').fill('not-a-source');
  await expect(page.locator('#passport-list')).toContainText('No saved sources match');
  await page.locator('#passport-search').fill('');
  await page.locator('.pi-details').click();await expect(page.locator('#dataset-detail')).toBeVisible();
  await page.locator('#dataset-detail .dialog-close').click();
  await expect(page.locator('.pi-details')).toBeFocused();
  await page.locator('.pi-remove').click();await expect(page.locator('#passport-count')).toHaveText('0');
  await page.locator('#passport-undo').click();await expect(page.locator('.passport-item')).toHaveCount(1);
  const title=await page.locator('.pi-title').textContent();
  await page.locator('#passport-project').click();await expect(page.locator('#workbench')).toBeVisible();
  await expect(page.locator('.workbench-card').filter({has:page.getByRole('heading',{name:title,exact:true})}).locator('.workbench-select')).toBeChecked();
  await expect(page.locator('.workbench-select:checked')).not.toHaveCount(0);
});
test('Passport inventory import merges known IDs and rejects malformed files',async({page})=>{
  await ready(page);await page.locator('#passport-btn').click();
  await page.locator('#passport-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await expect(page.locator('#passport-feedback')).toContainText('Invalid JSON');
  await expect(page.locator('#passport-import')).toHaveAttribute('aria-invalid','true');
  // Use the sanitized card ID rather than assuming the raw catalog carries one.
  await page.locator('#passport-discover').click();await page.locator('#card-list .pin-btn').first().click();
  await page.locator('#passport-btn').click();await page.locator('.passport-exports summary').click();
  const download=page.waitForEvent('download');await page.locator('#passport-json').click();const file=await download;
  const fs=await import('node:fs/promises');const value=JSON.parse(await fs.readFile(await file.path(),'utf8'));
  value.datasets.push({id:'unknown-id'});
  await page.locator('#passport-import').setInputFiles({name:'inventory.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  await expect(page.locator('#passport-feedback')).toContainText('1 already saved; 1 unknown IDs skipped');
  await expect(page.locator('#passport-import')).toHaveAttribute('aria-invalid','false');
  await expect(page.locator('.passport-item')).toHaveCount(1);
});
test('mobile Passport export menu and clear undo remain usable',async({page})=>{
 await page.setViewportSize({width:320,height:700});await ready(page);await page.locator('#global-pill').click();await page.locator('#card-list .pin-btn').first().click();await page.locator('#passport-btn').click();
 await page.locator('.passport-exports summary').click();await expect(page.locator('#passport-csv')).toBeVisible();
 expect(await page.locator('#passport-drawer').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBeTruthy();
 await page.locator('#passport-clear').click();await expect(page.locator('#passport-undo')).toBeFocused();await page.locator('#passport-undo').click();await expect(page.locator('#passport-count')).toHaveText('1');
});
