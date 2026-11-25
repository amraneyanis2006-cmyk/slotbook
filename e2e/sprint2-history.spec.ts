import { expect, test } from '@playwright/test';
import { apiBook, apiLogIn, bangkokDatePlus, logIn } from './helpers';

test('E2E-09: Ken books, the detail shows "Booked by Ken Tan (Customer)"; after cancelling, a second "Cancelled" line', async ({ page }) => {
  await logIn(page, 'cust.ken@slotbook.test');
  await apiLogIn(page, 'cust.ken@slotbook.test');
  const reference = await apiBook(page, bangkokDatePlus(6), '13:00', 'Anan Wong');

  await page.goto(`/bookings/${reference}`);
  const history = page.getByRole('region', { name: 'History' });
  await expect(history.getByRole('listitem')).toHaveCount(1);
  await expect(history.getByRole('listitem').first()).toContainText('Booked by Ken Tan (Customer)');

  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await page.getByRole('button', { name: 'Yes, cancel booking' }).click();
  await expect(page.getByText('Booking cancelled')).toBeVisible();
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await expect(history.getByRole('listitem').nth(1)).toContainText('Cancelled by Ken Tan (Customer)');
});
