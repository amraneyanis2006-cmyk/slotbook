import { expect, test } from '@playwright/test';
import { createCustomer, deleteUser } from './db';
import { logIn } from './helpers';

const EMAIL = 'cust.e2e19@slotbook.test';

test('E2E-19: Anan deactivates a customer through the dialog; the row shows Inactive; the customer is sent back to log in with "Your session has ended."', async ({ browser }) => {
  await createCustomer(EMAIL, 'Zed Leaving');
  try {
    const customer = await (await browser.newContext()).newPage();
    await logIn(customer, EMAIL);
    const staff = await (await browser.newContext()).newPage();
    await logIn(staff, 'staff.anan@slotbook.test');
    await staff.getByRole('banner').getByRole('link', { name: 'Accounts' }).click();
    await staff.getByLabel('Search by name').fill('Zed');
    await staff.getByRole('button', { name: 'Search' }).click();
    await staff.getByRole('button', { name: 'Deactivate Zed Leaving' }).click();
    const dialog = staff.getByRole('dialog', { name: 'Deactivate Zed Leaving?' });
    await expect(dialog).toContainText('This customer has no upcoming booking.');
    await dialog.getByRole('button', { name: 'Yes, deactivate' }).click();
    await expect(staff.getByRole('row', { name: /Zed Leaving/ })).toContainText('Inactive');

    await customer.getByRole('banner').getByRole('link', { name: 'My Bookings' }).click();
    await expect(customer).toHaveURL(/\/login$/);
    await expect(customer.getByRole('status').filter({ hasText: 'Your session has ended.' })).toBeVisible();
  } finally {
    await deleteUser(EMAIL);
  }
});
