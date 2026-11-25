import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoOverflow, seedReference, switchUser } from './helpers';
import { VIEWPORTS } from './viewports';

// AC-68 (NFR-08, NFR-09): the new or changed Sprint 2 screens at 320, 768 and 1280 px; new dialogs by keyboard.
type Screen = { email: string; path: (page: Page) => Promise<string>; ready: (page: Page) => Locator; open?: (page: Page) => Promise<void> };

const SCREENS: Screen[] = [
  { email: 'staff.anan@slotbook.test', path: async () => '/staff/services', ready: (p) => p.getByRole('button', { name: 'Add service' }) },
  {
    email: 'staff.anan@slotbook.test', path: async () => '/staff/slots', ready: (p) => p.getByRole('button', { name: /^Actions for / }).first(),
    open: async (p) => { await p.getByRole('button', { name: /^Actions for / }).first().click(); },
  },
  {
    email: 'staff.anan@slotbook.test', path: async (p) => `/staff/bookings/${await seedReference(p, 'staff.anan@slotbook.test', 3, '10:00')}`,
    ready: (p) => p.getByRole('heading', { name: 'History' }),
  },
  {
    email: 'cust.ken@slotbook.test', path: async (p) => `/bookings/${await seedReference(p, 'staff.anan@slotbook.test', 3, '10:00')}`,
    ready: (p) => p.getByRole('heading', { name: 'History' }),
  },
  {
    email: 'cust.ken@slotbook.test', path: async (p) => `/bookings/${await seedReference(p, 'staff.anan@slotbook.test', 3, '10:00')}/reschedule`,
    ready: (p) => p.getByRole('button', { name: 'Move booking' }),
  },
  { email: 'cust.ploy@slotbook.test', path: async () => '/search', ready: (p) => p.getByRole('button', { name: 'Search' }) },
];

test('E2E-15: Sprint 2 screens have no horizontal scroll or clipped control at 320, 768 and 1280 px; new dialogs trap focus, close with Esc and return focus', async ({ page }) => {
  test.setTimeout(60_000); // 18 page loads plus two dialogs: above the 30 s default on a loaded runner
  for (const screen of SCREENS) {
    const path = await screen.path(page);
    await switchUser(page, screen.email);
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(size);
      await page.goto(path);
      await expect(screen.ready(page)).toBeVisible();
      if (screen.open) await screen.open(page);
      await expectNoOverflow(page, `${path} at ${name} ${size.width}px`);
    }
  }

  // Keyboard: the Deactivate dialog of Services (F-11) and the Cancel slot dialog of My Slots (F-07).
  await page.setViewportSize(VIEWPORTS.desktop);
  await switchUser(page, 'staff.anan@slotbook.test');
  await page.goto('/staff/services');
  const deactivate = page.getByRole('button', { name: 'Deactivate Academic advising' });
  await deactivate.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Deactivate Academic advising?' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true); // focus stays inside
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(deactivate).toBeFocused();

  await page.goto('/staff/slots');
  const actions = page.getByRole('button', { name: /^Actions for / }).first();
  await actions.focus();
  await page.keyboard.press('Enter');
  const cancel = page.getByRole('button', { name: 'Cancel slot' }).first();
  await cancel.focus();
  await page.keyboard.press('Enter');
  const cancelDialog = page.getByRole('dialog', { name: 'Cancel this slot?' });
  await expect(cancelDialog).toBeVisible();
  await expect(cancelDialog.getByLabel('Reason')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cancelDialog).toHaveCount(0);
  await expect(cancel).toBeFocused(); // the menu stays open while its dialog is open (F-07 §4)
});
