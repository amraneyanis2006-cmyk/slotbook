import { expect, test } from '@playwright/test';
import { bangkokDatePlus, logIn } from './helpers';

test('E2E-17: Mali creates a template with two entries, generates two weeks, sees the summary and the new slots on My Slots', async ({ page }) => {
  await logIn(page, 'staff.mali@slotbook.test');
  await page.getByRole('banner').getByRole('link', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'New template' }).click();
  await page.getByLabel('Name').fill('E2E-17 weeks');
  await page.getByLabel('Weekday').selectOption('Tuesday');
  await page.getByLabel('Start time').selectOption('11:00');
  await page.getByLabel('Service').selectOption({ label: 'Academic advising (30 min)' });
  await page.getByRole('button', { name: 'Add entry' }).click();
  await page.getByLabel('Weekday').nth(1).selectOption('Thursday');
  await page.getByLabel('Start time').nth(1).selectOption('15:30');
  await page.getByLabel('Service').nth(1).selectOption({ label: 'Academic advising (30 min)' });
  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.getByText('Tuesday 11:00 — Academic advising')).toBeVisible();

  // Two weeks after the seed and E2E data (today+15 … today+28): every Tuesday and Thursday → 4 slots.
  await page.getByRole('button', { name: 'Generate slots from E2E-17 weeks' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('From').fill(bangkokDatePlus(15));
  await dialog.getByLabel('To').fill(bangkokDatePlus(28));
  await dialog.getByRole('button', { name: 'Generate slots' }).click();
  await expect(dialog.getByRole('status')).toHaveText('4 slots created, 0 skipped');
  await dialog.getByRole('link', { name: 'My Slots' }).click();
  await expect(page.getByRole('row').filter({ hasText: '11:00–11:30' })).toHaveCount(2);
  await expect(page.getByRole('row').filter({ hasText: '15:30–16:00' })).toHaveCount(2);
});
