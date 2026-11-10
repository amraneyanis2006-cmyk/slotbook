import { expect, test } from '@playwright/test';
import { apiBook, apiLogIn, bangkokDatePlus, logIn } from './helpers';

// The global-setup Mali slot: today+10 (Asia/Bangkok) at 15:00 (E2E-05 cancelled the journey booking on it).
const SLOT_DATE = bangkokDatePlus(10);

test('E2E-06: after Ploy books the Mali slot, Mali sees the reference and "Ploy Chai" on Schedule for that day; Anan does not', async ({ browser, page }) => {
  const customer = await browser.newContext();
  const ploy = await customer.newPage();
  await apiLogIn(ploy, 'cust.ploy@slotbook.test');
  const reference = await apiBook(ploy, SLOT_DATE, '15:00', 'Mali Srisuk');
  await customer.close();

  await logIn(page, 'staff.mali@slotbook.test');
  await page.getByRole('banner').getByRole('link', { name: 'Schedule' }).click();
  await expect(page).toHaveURL(/\/staff\/schedule$/);
  await page.getByLabel('Date').fill(SLOT_DATE);
  const row = page.getByRole('row', { name: new RegExp(reference) });
  await expect(row).toContainText('Ploy Chai');
  await expect(row).toContainText('15:00–15:30');
  await expect(page.getByText(/^\d+ slots? · 1 booked · \d+ open · \d+ closed$/)).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await logIn(page, 'staff.anan@slotbook.test');
  await page.goto('/staff/schedule');
  await page.getByLabel('Date').fill(SLOT_DATE);
  await expect(page.getByText('No slots on this day.')).toBeVisible();
  await expect(page.getByText(reference)).toHaveCount(0);
  await expect(page.getByText('Ploy Chai')).toHaveCount(0);
});
