import { expect, test } from '@playwright/test';
import { expectNoOverflow, switchUser } from './helpers';
import { VIEWPORTS } from './viewports';

// AC-85 (NFR-08, NFR-09): the Sprint 3 screens at 320, 768 and 1280 px; the Deactivate dialog by keyboard.
const SCREENS: [string, string, string][] = [
  ['staff.anan@slotbook.test', '/staff/templates', 'Templates'],
  ['staff.anan@slotbook.test', '/staff/users', 'Accounts'],
  ['staff.anan@slotbook.test', '/staff/dashboard', 'Dashboard'],
  ['cust.ken@slotbook.test', '/notifications', 'Notifications'],
];

test('E2E-21: Sprint 3 screens have no horizontal scroll or clipped control at 320, 768 and 1280 px; the Deactivate dialog traps focus and closes with Esc', async ({ page }) => {
  test.setTimeout(120_000);
  for (const [email, path, heading] of SCREENS) {
    await switchUser(page, email);
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(size);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.getByLabel(/^Loading/)).toHaveCount(0);
      await expectNoOverflow(page, `${path} at ${name} ${size.width}px`);
    }
  }

  await page.setViewportSize(VIEWPORTS.desktop);
  await switchUser(page, 'staff.anan@slotbook.test');
  await page.goto('/staff/users');
  const deactivate = page.getByRole('button', { name: 'Deactivate Ploy Chai' });
  await deactivate.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Deactivate Ploy Chai?' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(deactivate).toBeFocused();
});
