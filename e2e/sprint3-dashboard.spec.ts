import { expect, test } from '@playwright/test';
import { bangkokDatePlus, expectNoOverflow, logIn } from './helpers';
import { VIEWPORTS } from './viewports';

test('E2E-16: Anan opens Dashboard, sees the tiles and per-service table for 30 days, narrows the period (URL follows), no horizontal scroll at 320 px', async ({ page }) => {
  await logIn(page, 'staff.anan@slotbook.test');
  await page.getByRole('banner').getByRole('link', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(/\/staff\/dashboard$/);

  // Seed: Anan has 3 slots a day from today−2, and a COMPLETED booking yesterday at 09:00 (Academic advising).
  const tile = (label: string) => page.locator('.tile').filter({ has: page.getByText(label, { exact: true }) });
  await expect(tile('Slots').locator('dd')).toHaveText('9');
  await expect(tile('No-show rate').locator('dd')).toHaveText('0.0 %');
  await expect(page.getByRole('row', { name: /Academic advising/ })).toBeVisible();

  await page.getByLabel('From').fill(bangkokDatePlus(-2));
  await page.getByLabel('To').fill(bangkokDatePlus(-2));
  await page.getByRole('button', { name: 'Show' }).click();
  await expect(page).toHaveURL(new RegExp(`from=${bangkokDatePlus(-2)}&to=${bangkokDatePlus(-2)}$`));
  await expect(tile('Slots').locator('dd')).toHaveText('3');
  await expect(tile('No-show rate').locator('dd')).toHaveText('—');
  await expect(page.getByText('No outcome recorded in this period.')).toBeVisible();

  await page.setViewportSize(VIEWPORTS.mobile);
  await expectNoOverflow(page, 'dashboard at 320px');
});
