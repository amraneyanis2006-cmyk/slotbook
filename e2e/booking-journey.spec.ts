import { expect, test, type Page } from '@playwright/test';

const PASSWORD = process.env.SEED_PASSWORD;
if (!PASSWORD) throw new Error('SEED_PASSWORD is not set (copy .env.example to .env).');

// The free Mali slot created by e2e/global-setup.ts: today+10 (Asia/Bangkok) at 15:00, Academic advising.
const bangkokDatePlus = (days: number) =>
  new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
const SLOT_DATE = bangkokDatePlus(10);

async function logIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test.describe.serial('Customer booking journey (F-04, F-05)', () => {
  test('E2E-04: Ploy filters the date and service, books the Mali slot with a note, sees the reference and the slot leaves the list', async ({ page }) => {
    await logIn(page, 'cust.ploy@slotbook.test');
    await expect(page).toHaveURL(/\/book$/);

    await page.getByLabel('Date').fill(SLOT_DATE);
    await page.getByLabel('Service').selectOption({ label: 'Academic advising' });
    const book = page.getByRole('button', { name: /^Book 15:00 Academic advising with Mali Srisuk/ });
    await expect(book).toBeVisible();
    await book.click();

    const dialog = page.getByRole('dialog', { name: 'Confirm booking' });
    await dialog.getByLabel('Note (optional)').fill('Question about credit transfer');
    await dialog.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(dialog.getByText(/^Booked! Reference BK-\d{4}-\d{6}$/)).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Go to My Bookings' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Close' }).click();
    // The refreshed list is loaded (no skeleton) and no longer offers the booked slot.
    await expect(page.getByRole('region', { name: /^Available slots/ }).locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(page.getByText('No available slots on this day. Try another date.')).toBeVisible();
    await expect(book).toHaveCount(0);
  });
});
