import { expect, test } from '@playwright/test';
import { bangkokDatePlus, logIn } from './helpers';

test('E2E-14: Ken searches 7 days for Career counselling with Anan, sees results by day, books one; after a reload of the URL it is gone', async ({ page }) => {
  await logIn(page, 'cust.ken@slotbook.test');
  await page.getByRole('banner').getByRole('link', { name: 'Find a Slot' }).click();
  await page.getByLabel('From').fill(bangkokDatePlus(2));
  await page.getByLabel('To').fill(bangkokDatePlus(8));
  await page.getByLabel('Service').selectOption({ label: 'Career counselling' });
  await page.getByLabel('Staff').selectOption({ label: 'Anan Wong' });
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/search\?from=.*&to=.*&serviceId=\d+&staffId=\d+$/);

  const books = page.getByRole('button', { name: /^Book .* Career counselling with Anan Wong$/ });
  await expect(books.first()).toBeVisible();
  const before = await books.count();
  expect(before).toBeGreaterThan(1);
  await expect(page.getByRole('heading', { level: 3 }).first()).toContainText(/ — \d+ slots?$/);
  const label = (await books.first().getAttribute('aria-label'))!;

  await books.first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm booking' }).click();
  const booked = page.getByRole('dialog').getByText(/^Booked! Reference BK-\d{4}-\d{6}$/);
  await expect(booked).toBeVisible();
  const reference = (await booked.textContent())!.replace('Booked! Reference ', '');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  await page.reload();
  await expect(books).toHaveCount(before - 1);
  await expect(page.getByRole('button', { name: label })).toHaveCount(0);

  // Leave Ken with his usual bookings (helpers.ts counts).
  expect((await page.request.post(`/api/bookings/${reference}/cancel`, { data: {} })).status()).toBe(200);
});
