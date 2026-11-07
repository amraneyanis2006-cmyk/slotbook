import { expect, test, type Page } from '@playwright/test';

const PASSWORD = process.env.SEED_PASSWORD ?? '';

async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('E2E-01: each role lands on its home with name and role in the header; logout and wrong password', async ({ page }) => {
  await logIn(page, 'cust.ploy@slotbook.test');
  await expect(page).toHaveURL(/\/book$/);
  const header = page.getByRole('banner');
  await expect(header).toContainText('Ploy Chai');
  await expect(header).toContainText('Customer');

  await header.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Ploy Chai')).toHaveCount(0);

  await logIn(page, 'staff.mali@slotbook.test');
  await expect(page).toHaveURL(/\/staff\/slots$/);
  await expect(page.getByRole('banner')).toContainText('Mali Srisuk');
  await expect(page.getByRole('banner')).toContainText('Staff');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await logIn(page, 'staff.mali@slotbook.test', 'wrong-password');
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await expect(page).toHaveURL(/\/login$/);
});

test('E2E-02: protected pages redirect anonymous users to /login and other roles to their own home', async ({ page }) => {
  await page.goto('/bookings');
  await expect(page).toHaveURL(/\/login$/);

  await logIn(page, 'cust.ploy@slotbook.test');
  await expect(page).toHaveURL(/\/book$/);
  await page.goto('/staff/slots');
  await expect(page).toHaveURL(/\/book$/);
  await page.getByRole('button', { name: 'Log out' }).click();

  await logIn(page, 'staff.anan@slotbook.test');
  await expect(page).toHaveURL(/\/staff\/slots$/);
  await page.goto('/book');
  await expect(page).toHaveURL(/\/staff\/slots$/);
});
