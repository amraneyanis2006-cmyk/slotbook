import { expect, test, type Page } from '@playwright/test';
import { deleteBooking, insertBooking } from './db';
import { apiBook, apiLogIn, bangkokDatePlus, logIn } from './helpers';
import { VIEWPORTS } from './viewports';

// Demo evidence for the Deliverable 1 report (Part F): not part of the AC coverage. Screenshots at 1280×900 in
// artifacts/sprint-1/screenshots/<NN>-<name>.png, described in artifacts/sprint-1/screenshots/INDEX.md.
const DIR = 'artifacts/sprint-1/screenshots';
const TOMORROW = bangkokDatePlus(1);
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `${DIR}/${name}.png`, fullPage });
const loaded = (page: Page) => expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
const NOTE = 'Demo: request for a transcript translation'; // distinct from the seeded notes

test('SHOT-01: Sprint 1 demo screenshots (login, booking, rules, cancellation, staff, access control, responsive)', async ({ page, browser }) => {
  test.setTimeout(180_000);

  await page.goto('/login');
  await shot(page, '01-login');

  await logIn(page, 'cust.ploy@slotbook.test');
  await loaded(page);
  await shot(page, '02-customer-home');

  await page.getByLabel('Date').fill(TOMORROW);
  await loaded(page);
  await expect(page.getByRole('button', { name: /^Book 14:00 Academic advising with Mali Srisuk/ })).toBeVisible();
  await shot(page, '03-available-tomorrow');

  await page.getByRole('button', { name: /^Book 14:00 Academic advising with Mali Srisuk/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm booking' });
  await dialog.getByLabel('Note (optional)').fill(NOTE);
  await shot(page, '04-booking-dialog');

  await dialog.getByRole('button', { name: 'Confirm booking' }).click();
  const confirmation = dialog.getByText(/^Booked! Reference BK-\d{4}-\d{6}$/);
  await expect(confirmation).toBeVisible();
  const reference = (await confirmation.textContent())!.replace('Booked! Reference ', '');
  await shot(page, '05-booking-confirmation');
  await dialog.getByRole('button', { name: 'Close' }).click();

  await page.goto('/bookings');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Upcoming' }).getByText(reference)).toBeVisible();
  await shot(page, '06-my-bookings-after-reload');

  await page.getByRole('link', { name: `View ${reference}` }).click();
  await expect(page.getByText(NOTE)).toBeVisible();
  await shot(page, '07-booking-detail');

  await page.goto(`/api/bookings/${reference}`);
  await expect(page.getByText(`"reference":"${reference}"`)).toBeVisible();
  await shot(page, '08-booking-api-json');

  // BR-04: Mali publishes 09:00 tomorrow (through the API), which overlaps Ploy's seeded Anan 09:00–09:30 booking.
  const mali = await browser.newContext();
  const maliPage = await mali.newPage();
  await apiLogIn(maliPage, 'staff.mali@slotbook.test');
  const advising = (await (await maliPage.request.get('/api/services')).json()).services
    .find((s: { name: string }) => s.name === 'Academic advising').id;
  expect((await maliPage.request.post('/api/staff/slots', { data: { serviceId: advising, date: TOMORROW, startTime: '09:00' } })).status()).toBe(201);
  await mali.close();
  await page.goto('/book');
  await page.getByLabel('Date').fill(TOMORROW);
  await page.getByRole('button', { name: /^Book 09:00 Academic advising with Mali Srisuk/ }).click();
  await dialog.getByRole('button', { name: 'Confirm booking' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('You already have a booking at this time.');
  await shot(page, '10-overlap-rejected');
  await page.keyboard.press('Escape');

  // BR-05: a booking starting in 75–90 minutes (next 15-minute step) offers no Cancel button. It is inserted directly,
  // bypassing the slot rules: through the API such a booking exists only during opening hours (BR-06), which would make
  // the run depend on the time of day. It is deleted after the shot so later specs see Ploy's usual bookings.
  const quarter = 15 * 60_000;
  const late = await insertBooking('staff.anan@slotbook.test', 'cust.ploy@slotbook.test', new Date(Math.ceil((Date.now() + 75 * 60_000) / quarter) * quarter));
  try {
    await page.goto(`/bookings/${late}`);
    await expect(page.getByText('Cancellation closes 2 hours before the start.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);
    await shot(page, '11-late-cancel-no-button');
  } finally {
    await deleteBooking(late);
  }

  // BR-03: Nina holds 3 active future bookings (made through the API), then tries a 4th in the UI.
  const nina = await browser.newContext();
  const ninaPage = await nina.newPage();
  await apiLogIn(ninaPage, 'cust.nina@slotbook.test');
  await apiBook(ninaPage, bangkokDatePlus(4), '09:00', 'Anan Wong');
  await apiBook(ninaPage, bangkokDatePlus(4), '14:00', 'Mali Srisuk');
  await apiBook(ninaPage, bangkokDatePlus(5), '13:00', 'Anan Wong');
  await ninaPage.goto('/book');
  await ninaPage.getByLabel('Date').fill(bangkokDatePlus(5));
  await ninaPage.getByRole('button', { name: /^Book 14:00 Academic advising with Mali Srisuk/ }).click();
  await ninaPage.getByRole('dialog').getByRole('button', { name: 'Confirm booking' }).click();
  await expect(ninaPage.getByRole('dialog').getByRole('alert')).toHaveText('You already have 3 upcoming bookings, the maximum.');
  await shot(ninaPage, '09-limit-rejected');
  await nina.close();

  // Staff: Mali publishes a slot, then an overlapping one; Mali's and Anan's schedules for tomorrow.
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await logIn(staffPage, 'staff.mali@slotbook.test');
  await staffPage.getByLabel('Service').selectOption({ label: 'Academic advising' });
  await staffPage.getByLabel('Date').fill(bangkokDatePlus(8));
  await staffPage.getByLabel('Start time').selectOption('10:00');
  await staffPage.getByRole('button', { name: 'Publish slot' }).click();
  const published = staffPage.getByRole('status').filter({ hasText: 'Slot published' });
  await expect(published).toBeVisible();
  const newRow = staffPage.getByRole('row', { name: /10:00–10:30/ });
  await expect(newRow).toContainText('Open');
  await newRow.scrollIntoViewIfNeeded();
  await shot(staffPage, '13-my-slots-new-slot');
  await expect(published).toHaveCount(0, { timeout: 8_000 }); // the toast of shot 13 must not appear in shot 14
  await staffPage.getByLabel('Start time').selectOption('10:15');
  await staffPage.getByRole('button', { name: 'Publish slot' }).click();
  const overlapError = staffPage.getByRole('alert');
  await expect(overlapError).toHaveText('You already have a slot at this time.');
  await staffPage.getByRole('heading', { name: 'Publish a slot' }).scrollIntoViewIfNeeded(); // the form and its error
  await expect(overlapError).toBeInViewport();
  await shot(staffPage, '14-slot-overlap');

  await staffPage.goto('/staff/schedule');
  await staffPage.getByLabel('Date').fill(TOMORROW);
  await expect(staffPage.getByRole('row', { name: new RegExp(reference) })).toContainText('Ploy Chai');
  await shot(staffPage, '15-schedule-mali');
  await staffPage.getByRole('button', { name: 'Log out' }).click();
  await logIn(staffPage, 'staff.anan@slotbook.test');
  await staffPage.goto('/staff/schedule');
  await staffPage.getByLabel('Date').fill(TOMORROW);
  await loaded(staffPage);
  await expect(staffPage.getByText(reference)).toHaveCount(0);
  await shot(staffPage, '16-schedule-anan');
  await staff.close();

  // BR-05 / BR-11: Ploy cancels the booking of shot 05.
  await page.goto(`/bookings/${reference}`);
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await page.getByRole('button', { name: 'Yes, cancel booking' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Booking cancelled' })).toBeVisible();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  await shot(page, '12-cancellation-success');

  // Access control: UI redirect, API 403, logout, API 401 afterwards.
  // Shot 17: screenshots have no address bar, so a caption shows the requested path and the path the browser ended
  // on (read from location.pathname after the redirect). The header proves the user is the Customer Ploy.
  await page.goto('/staff/slots');
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole('banner')).toContainText('Ploy Chai');
  await expect(page.getByRole('banner')).toContainText('Customer');
  await loaded(page);
  await page.evaluate(() => {
    const caption = document.createElement('div');
    caption.id = 'evidence-caption';
    caption.textContent = `Requested /staff/slots as Customer → redirected to ${window.location.pathname}`;
    caption.style.cssText = 'position:fixed;left:16px;bottom:16px;padding:8px 12px;border-radius:8px;background:#1f2933;color:#fff;font:600 15px system-ui,sans-serif';
    document.body.append(caption);
  });
  await expect(page.locator('#evidence-caption')).toHaveText('Requested /staff/slots as Customer → redirected to /book');
  await shot(page, '17-customer-redirected');
  await page.locator('#evidence-caption').evaluate((el) => el.remove());
  await page.goto('/api/staff/slots');
  await expect(page.getByText('"error":"FORBIDDEN"')).toBeVisible();
  await shot(page, '18-api-forbidden');
  await page.goto('/book');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await shot(page, '19-logout');
  await page.goto('/api/auth/me');
  await expect(page.getByText('"error":"UNAUTHENTICATED"')).toBeVisible();
  await shot(page, '20-api-unauthenticated');

  // Responsive: /book at the three NFR-08 widths (full page).
  await logIn(page, 'cust.ploy@slotbook.test');
  for (const [file, size] of [['21-book-320', VIEWPORTS.mobile], ['22-book-768', VIEWPORTS.tablet], ['23-book-1280', VIEWPORTS.desktop]] as const) {
    await page.setViewportSize(size);
    await page.getByLabel('Date').fill(TOMORROW);
    await loaded(page);
    await shot(page, file, true);
  }
});
