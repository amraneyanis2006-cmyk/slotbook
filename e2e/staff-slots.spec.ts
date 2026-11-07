import { expect, test } from '@playwright/test';

const PASSWORD = process.env.SEED_PASSWORD;
if (!PASSWORD) throw new Error('SEED_PASSWORD is not set (copy .env.example to .env).');

// today+9 in Asia/Bangkok: outside the seed range (today−2..today+7) and the global-setup slot (today+10).
const bangkokDatePlus = (days: number) =>
  new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);

test('E2E-03: Mali publishes a slot on My Slots and sees it listed; an overlapping slot shows the overlap message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('staff.mali@slotbook.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/staff\/slots$/);

  const rows = page.getByRole('row', { name: /14:00–14:30/ });
  await expect(page.getByRole('table')).toBeVisible();
  const before = await rows.count();

  await page.getByLabel('Service').selectOption({ label: 'Academic advising' });
  await page.getByLabel('Date').fill(bangkokDatePlus(9));
  await page.getByLabel('Start time').selectOption('14:00');
  await page.getByRole('button', { name: 'Publish slot' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Slot published' })).toBeVisible();
  await expect(rows).toHaveCount(before + 1);

  await page.getByLabel('Start time').selectOption('14:15');
  await page.getByRole('button', { name: 'Publish slot' }).click();
  await expect(page.getByRole('alert')).toHaveText('You already have a slot at this time.');
  await expect(rows).toHaveCount(before + 1);
});
