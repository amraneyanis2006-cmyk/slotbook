import { expect, test } from '@playwright/test';
import { apiBook, apiLogIn, bangkokDatePlus, logIn } from './helpers';

test('E2E-13: Ken reschedules a booking to another slot of the same service; the old one shows Cancelled with "Rescheduled to BK-…"', async ({ page }) => {
  const day = bangkokDatePlus(5);
  await logIn(page, 'cust.ken@slotbook.test');
  await apiLogIn(page, 'cust.ken@slotbook.test');
  const old = await apiBook(page, day, '09:00', 'Anan Wong');

  await page.goto(`/bookings/${old}`);
  await page.getByRole('link', { name: 'Reschedule' }).click();
  await expect(page).toHaveURL(new RegExp(`/bookings/${old}/reschedule$`));
  await page.getByRole('radio', { name: /09:30–10:00 · Mali Srisuk/ }).check();
  await page.getByRole('button', { name: 'Move booking' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, move booking' }).click();

  await expect(page.getByText(/^Booking moved to /)).toBeVisible();
  const fresh = (await page.getByRole('heading', { level: 1 }).textContent())!.replace('Booking ', '');
  expect(fresh).not.toBe(old);
  await expect(page.locator('.detail')).toContainText('Mali Srisuk');

  await page.goto(`/bookings/${old}`);
  await expect(page.locator('.detail')).toContainText('Cancelled');
  await expect(page.getByRole('region', { name: 'History' })).toContainText(`Rescheduled to ${fresh}`);

  // Leave Ken with his usual bookings (helpers.ts counts).
  expect((await page.request.post(`/api/bookings/${fresh}/cancel`, { data: {} })).status()).toBe(200);
});
