import { expect, test } from '@playwright/test';
import { createCustomer, deleteBooking, deleteUser, insertBooking } from './db';
import { bangkokDatePlus, logIn } from './helpers';

const EMAIL = 'cust.e2e18@slotbook.test';

test('E2E-18: Anan cancels a booked slot; the customer sees "Notifications (1)", reads the message with the reason, marks it as read and the count disappears', async ({ browser }) => {
  await createCustomer(EMAIL, 'Nina Notified');
  const reference = await insertBooking('staff.anan@slotbook.test', EMAIL, new Date(`${bangkokDatePlus(9)}T08:30:00+07:00`));
  try {
    const staff = await (await browser.newContext()).newPage();
    await logIn(staff, 'staff.anan@slotbook.test');
    const booked = staff.getByRole('row').filter({ hasText: `${reference} · Nina Notified` });
    await booked.getByRole('button', { name: /^Actions for / }).click();
    await booked.getByRole('button', { name: 'Cancel slot' }).click();
    const dialog = staff.getByRole('dialog', { name: 'Cancel this slot?' });
    await dialog.getByLabel('Reason').fill('Office closed');
    await dialog.getByRole('button', { name: 'Cancel slot' }).click();
    await expect(staff.getByText('Slot cancelled')).toBeVisible();

    const customer = await (await browser.newContext()).newPage();
    await logIn(customer, EMAIL);
    const link = customer.getByRole('banner').getByRole('link', { name: 'Notifications, 1 unread' });
    await expect(link).toHaveText('Notifications (1)');
    await link.click();
    await expect(customer).toHaveURL(/\/notifications$/);
    const item = customer.getByRole('listitem').filter({ hasText: reference });
    await expect(item).toContainText('was cancelled by Anan Wong: Office closed.');
    await expect(item).toContainText('Unread');
    await item.getByRole('button', { name: 'Mark as read' }).click();
    await expect(item).not.toContainText('Unread');
    await expect(customer.getByRole('banner').getByRole('link', { name: 'Notifications', exact: true })).toHaveText('Notifications');
  } finally {
    await deleteBooking(reference);
    await deleteUser(EMAIL);
  }
});
