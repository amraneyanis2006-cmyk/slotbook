import { describe, expect, it } from 'vitest';
import { notificationFor } from '../../src/rules/notificationRules.js';

const booking = { customerId: 3, reference: 'BK-2031-000051', startAt: new Date('2031-05-06T03:30:00.000Z') }; // Tue 6 May 2031, 10:30 Bangkok
const anan = { id: 1, name: 'Anan Wong', role: 'STAFF' as const };
const ploy = { id: 3, name: 'Ploy Chai', role: 'CUSTOMER' as const };

describe('notificationFor (F-16 §2)', () => {
  it('UNIT-17: null for the customer\'s own changes; the §1 messages for staff cancellations and outcomes', () => {
    expect(notificationFor({ to: 'CANCELLED', reason: null }, booking, ploy)).toBeNull();
    expect(notificationFor({ to: 'BOOKED', reason: 'Rescheduled from BK-1' }, booking, ploy)).toBeNull();
    expect(notificationFor({ to: 'CANCELLED', reason: 'Staff illness' }, booking, anan)).toEqual({
      userId: 3, message: 'Your booking BK-2031-000051 on Tue 6 May 2031, 10:30 was cancelled by Anan Wong: Staff illness.' });
    expect(notificationFor({ to: 'CANCELLED', reason: 'account deactivated' }, booking, anan)?.message)
      .toBe('Your booking BK-2031-000051 on Tue 6 May 2031, 10:30 was cancelled by Anan Wong: account deactivated.');
    expect(notificationFor({ to: 'NO_SHOW', reason: null }, booking, anan)?.message).toBe('Your booking BK-2031-000051 on Tue 6 May 2031, 10:30 was recorded as No-show.');
    expect(notificationFor({ to: 'COMPLETED', reason: null }, booking, anan)?.message).toBe('Your booking BK-2031-000051 on Tue 6 May 2031, 10:30 was recorded as Completed.');
    expect(notificationFor({ to: 'BOOKED', reason: null }, booking, anan)).toBeNull();
  });
});
