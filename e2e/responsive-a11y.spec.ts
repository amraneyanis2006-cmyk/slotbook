import { expect, test, type Locator, type Page } from '@playwright/test';
import { bangkokDatePlus, logIn, PASSWORD } from './helpers';
import { VIEWPORTS } from './viewports';

// AC-30 (NFR-08, NFR-09): the five Sprint 1 screens at 320, 768 and 1280 px; keyboard-only login + booking.
// The native date field takes keystrokes in the browser's UI language: force MM/DD/YYYY on any OS (E2E-08).
test.use({ locale: 'en-US', launchOptions: { args: ['--lang=en-US'] } });
const SCREENS: { email: string | null; path: string; ready: (page: Page) => Locator }[] = [
  { email: null, path: '/login', ready: (p) => p.getByRole('button', { name: 'Log in' }) },
  { email: 'cust.ploy@slotbook.test', path: '/book', ready: (p) => p.getByLabel('Service') },
  { email: 'cust.ploy@slotbook.test', path: '/bookings', ready: (p) => p.getByRole('heading', { name: 'Upcoming' }) },
  { email: 'staff.mali@slotbook.test', path: '/staff/slots', ready: (p) => p.getByRole('button', { name: 'Publish slot' }) },
  { email: 'staff.mali@slotbook.test', path: '/staff/schedule', ready: (p) => p.getByRole('button', { name: 'Next day' }) },
];

/** No horizontal page scroll, and every visible control lies fully inside the viewport width. */
async function expectNoOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth, clipped } = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const controls = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')]
      .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: width,
      clipped: controls.filter((el) => { const r = el.getBoundingClientRect(); return r.left < 0 || r.right > width + 0.5; })
        .map((el) => el.outerHTML.slice(0, 80)),
    };
  });
  expect(scrollWidth, `${label}: horizontal page scroll`).toBeLessThanOrEqual(clientWidth);
  expect(clipped, `${label}: clipped controls`).toEqual([]);
}

test('E2E-07: /login, /book, /bookings, /staff/slots and /staff/schedule have no horizontal scroll or clipped control at 320, 768 and 1280 px', async ({ page }) => {
  let current: string | null = null;
  for (const screen of SCREENS) {
    if (screen.email !== current) {
      if (current) await page.getByRole('button', { name: 'Log out' }).click();
      if (screen.email) await logIn(page, screen.email);
      current = screen.email;
    }
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(size);
      await page.goto(screen.path);
      await expect(screen.ready(page)).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expectNoOverflow(page, `${screen.path} at ${name} ${size.width}px`);
      if (screen.email) await expect(page.getByRole('button', { name: 'Log out' })).toBeInViewport();
    }
  }
});

/** Presses Tab until `target` has focus (fails after 40 presses), checking each focused element shows an outline. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) {
      await expectVisibleFocus(page);
      return;
    }
  }
  throw new Error('Could not reach the element with Tab');
}

async function expectVisibleFocus(page: Page) {
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThan(0);
}

test('E2E-08: Ken logs in and books a slot with Tab/Shift+Tab/Enter/Esc only, with a visible focus ring', async ({ page }) => {
  const date = bangkokDatePlus(6); // seed slots; Anan 09:00 is the first of the day
  await page.goto('/login');
  await tabTo(page, page.getByLabel('Email'));
  await page.keyboard.type('cust.ken@slotbook.test');
  await tabTo(page, page.getByLabel('Password'));
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/book$/);

  await tabTo(page, page.getByLabel('Date'));
  const [year, month, day] = date.split('-');
  await page.keyboard.type(`${month}${day}${year}`);
  await expect(page.getByLabel('Date')).toHaveValue(date);

  const book = page.getByRole('button', { name: /^Book 09:00 Academic advising with Anan Wong/ });
  await expect(book).toBeVisible();
  await tabTo(page, book);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Confirm booking' });
  await expect(dialog).toBeVisible();

  // Esc closes and returns focus to Book; Shift+Tab inside the dialog wraps to its last button.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(book).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Note (optional)')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectVisibleFocus(page);

  await tabTo(page, dialog.getByRole('button', { name: 'Confirm booking' }));
  await page.keyboard.press('Enter');
  await expect(dialog.getByText(/^Booked! Reference BK-\d{4}-\d{6}$/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
