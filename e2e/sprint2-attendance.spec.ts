import { expect, test } from '@playwright/test';
import { deleteBooking, insertBooking } from './db';
import { logIn, switchUser } from './helpers';

test('E2E-12: Anan records No-show for a booking that has started today; Ploy sees No-show in Past and cancelled', async ({ page }) => {
  // A booking that started a few minutes ago, today in Bangkok (the API cannot create one: BR-02). Rules bypassed on purpose.
  const now = Date.now();
  const bangkokMidnight = Date.parse(`${new Date(now + 7 * 3_600_000).toISOString().slice(0, 10)}T00:00:00+07:00`);
  const startAt = new Date(Math.max(now - 20 * 60_000, bangkokMidnight + 60_000));
  startAt.setUTCSeconds(0, 0);
  const reference = await insertBooking('staff.anan@slotbook.test', 'cust.ploy@slotbook.test', startAt);
  try {
    await logIn(page, 'staff.anan@slotbook.test');
    await page.getByRole('banner').getByRole('link', { name: 'Schedule' }).click();
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: reference }) });
    await row.getByRole('button', { name: `No-show ${reference}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Record No-show?' });
    await expect(dialog).toContainText(`Record Ploy Chai as No-show for ${reference}? This cannot be changed.`);
    await dialog.getByRole('button', { name: 'Yes, record No-show' }).click();
    await expect(page.getByText('Outcome recorded')).toBeVisible();
    await expect(row).toContainText('No-show');
    await expect(row.getByRole('button')).toHaveCount(0);

    await switchUser(page, 'cust.ploy@slotbook.test');
    await page.getByRole('banner').getByRole('link', { name: 'My Bookings' }).click();
    const past = page.getByRole('region', { name: 'Past and cancelled' });
    await expect(past.getByRole('row').filter({ hasText: reference })).toContainText('No-show');
  } finally {
    await deleteBooking(reference);
  }
});
