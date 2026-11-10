import { expect, type Page } from '@playwright/test';

export const PASSWORD = process.env.SEED_PASSWORD ?? '';
if (!PASSWORD) throw new Error('SEED_PASSWORD is not set (copy .env.example to .env).');

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
