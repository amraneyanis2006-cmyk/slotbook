import { expect, type Page } from '@playwright/test';

export const PASSWORD = process.env.SEED_PASSWORD ?? '';
if (!PASSWORD) throw new Error('SEED_PASSWORD is not set (copy .env.example to .env).');

// All specs share one database reset by global-setup.ts, in an order Playwright decides. Active future bookings
// per customer (limit 3, BR-03) at any time, by spec:
//   Ploy: seed today+1 Anan 09:00; booking-journey books and cancels the global today+10 15:00 slot; SHOT-01 books
//         (then cancels) tomorrow Mali 14:00 and inserts (then deletes) one late booking; E2E-06 books today+10 15:00
//         again, after E2E-05 freed it → at most 3.
//   Ken:  seed today+3 Anan 10:00; E2E-08 books today+6 Anan 09:00; E2E-09 books (then cancels) today+6 Anan 13:00;
//         E2E-11 books today+7 Mali 09:30 (then Mali cancels the slot); E2E-13 books today+5 Anan 09:00, moves it to
//         Mali 09:30 and cancels it; E2E-14 books (then cancels) one Anan Career counselling slot → at most 3.
//   Nina: SHOT-01 books today+4 Anan 09:00, today+4 Mali 14:00, today+5 Anan 13:00 → 3 (then the 4th is refused).

/** Asia/Bangkok date `YYYY-MM-DD`, `days` from today (E2E data is relative to the real clock). */
export const bangkokDatePlus = (days: number) =>
  new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);

/** Logs in through the form and waits for the role home (/book or /staff/slots), so the session exists. */
export async function logIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(email.startsWith('staff.') ? /\/staff\/slots$/ : /\/book$/);
}

/** Logs in as another account: drops the current session cookie first, since /login redirects a signed-in user home. */
export async function switchUser(page: Page, email: string) {
  await page.context().clearCookies();
  await logIn(page, email);
}

/** Logs the page's API context in (shares the cookie with the page) for data set-up through the real API. */
export async function apiLogIn(page: Page, email: string) {
  const res = await page.request.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(res.status()).toBe(200);
}

/** Books, through the API, the first available slot of `date` matching `startTime` (HH:mm, Bangkok) and staff name. */
export async function apiBook(page: Page, date: string, startTime: string, staff: string) {
  const list = await page.request.get(`/api/slots/available?date=${date}`);
  const slots: { id: number; startAt: string; staff: { name: string } }[] = (await list.json()).slots;
  const hhmm = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(11, 16);
  const slot = slots.find((s) => hhmm(s.startAt) === startTime && s.staff.name === staff);
  if (!slot) throw new Error(`No available ${staff} slot at ${date} ${startTime}`);
  const res = await page.request.post('/api/bookings', { data: { slotId: slot.id } });
  expect(res.status()).toBe(201);
  return (await res.json()).booking.reference as string;
}

/** No horizontal page scroll, and every visible control lies fully inside the viewport width. */
export async function expectNoOverflow(page: Page, label: string) {
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


/** Reference of the seed booking of `customer` on `staff`'s slot at `time`, `days` from today (via the staff schedule API). */
export async function seedReference(page: Page, staffEmail: string, days: number, time: string) {
  await apiLogIn(page, staffEmail);
  const res = await page.request.get(`/api/staff/schedule?date=${bangkokDatePlus(days)}`);
  const slots: { startAt: string; booking: { reference: string } | null }[] = (await res.json()).slots;
  const hhmm = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(11, 16);
  const slot = slots.find((s) => hhmm(s.startAt) === time && s.booking);
  if (!slot) throw new Error(`No booked ${staffEmail} slot at today+${days} ${time}`);
  return slot.booking!.reference;
}
