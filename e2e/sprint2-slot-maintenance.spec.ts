import { expect, test } from '@playwright/test';
import { formatDay } from '../client/src/utils/time';
import { apiBook, apiLogIn, bangkokDatePlus, switchUser } from './helpers';

test('E2E-11: Mali cancels Ken\'s booked slot with "Staff illness"; Ken sees Cancelled and the reason; Mali closes and reopens an open slot with the keyboard', async ({ page }) => {
  const day = bangkokDatePlus(7);
  await apiLogIn(page, 'cust.ken@slotbook.test');
  const reference = await apiBook(page, day, '09:30', 'Mali Srisuk');

  await switchUser(page, 'staff.mali@slotbook.test');
  const booked = page.getByRole('row').filter({ hasText: `${reference} · Ken Tan` });
  await booked.getByRole('button', { name: /^Actions for / }).click();
  await booked.getByRole('button', { name: 'Cancel slot' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cancel this slot?' });
  await expect(dialog).toContainText(`The booking ${reference} of Ken Tan will be cancelled`);
  await dialog.getByLabel('Reason').fill('Staff illness');
  await dialog.getByRole('button', { name: 'Cancel slot' }).click();
  await expect(page.getByText('Slot cancelled')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: reference })).toHaveCount(0);

  // Keyboard only: open the Actions menu of the 14:00 slot, Close, then Reopen.
  const label = `Actions for ${formatDay(`${day}T07:00:00.000Z`)} 14:00`;
  const actions = page.getByRole('button', { name: label });
  const row = page.getByRole('row').filter({ has: actions });
  await actions.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); // Edit time
  await page.keyboard.press('Tab'); // Close
  await expect(row.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Slot closed')).toBeVisible();
  await expect(row).toContainText('Closed');
  await actions.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(row.getByRole('button', { name: 'Reopen' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(row).toContainText('Open');

  await switchUser(page, 'cust.ken@slotbook.test');
  await page.goto(`/bookings/${reference}`);
  await expect(page.getByRole('status').filter({ hasText: 'Cancelled by Mali Srisuk: Staff illness' })).toBeVisible();
  await expect(page.locator('.detail')).toContainText('Cancelled');
});
