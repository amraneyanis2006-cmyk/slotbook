import { expect, test } from '@playwright/test';
import { logIn } from './helpers';

test('E2E-10: Anan adds "Visa letter (30 min)", sees it in the slot form, deactivates it and it leaves the slot form', async ({ page }) => {
  await logIn(page, 'staff.anan@slotbook.test');
  await page.getByRole('banner').getByRole('link', { name: 'Services' }).click();
  await expect(page).toHaveURL(/\/staff\/services$/);

  await page.getByLabel('Name').fill('Visa letter');
  await page.getByLabel('Duration').selectOption('30');
  await page.getByRole('button', { name: 'Add service' }).click();
  await expect(page.getByText('Service added')).toBeVisible();
  const row = page.getByRole('row', { name: /Visa letter/ });
  await expect(row).toContainText('30 min');
  await expect(row).toContainText('Active');

  await page.getByRole('banner').getByRole('link', { name: 'My Slots' }).click();
  await expect(page.getByLabel('Service').locator('option', { hasText: 'Visa letter' })).toHaveCount(1);

  await page.getByRole('banner').getByRole('link', { name: 'Services' }).click();
  await page.getByRole('button', { name: 'Deactivate Visa letter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, deactivate' }).click();
  await expect(page.getByRole('row', { name: /Visa letter/ })).toContainText('Inactive');

  await page.getByRole('banner').getByRole('link', { name: 'My Slots' }).click();
  await expect(page.getByLabel('Service').locator('option', { hasText: 'Academic advising' })).toHaveCount(1);
  await expect(page.getByLabel('Service').locator('option', { hasText: 'Visa letter' })).toHaveCount(0);
});
