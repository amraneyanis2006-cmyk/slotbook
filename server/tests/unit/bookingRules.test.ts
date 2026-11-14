import { describe, expect, it } from 'vitest';
import { BOOKING_LEAD_MIN, CANCEL_WINDOW_MIN, MAX_ACTIVE_BOOKINGS, canCustomerCancel, checkCustomerLimits, formatReference, isBookable } from '../../src/rules/bookingRules.js';

const NOW = new Date('2026-11-10T08:00:00+07:00');
const plus = (min: number) => new Date(NOW.getTime() + min * 60_000);
const at = (hhmm: string, day = '2026-11-12') => new Date(`${day}T${hhmm}:00+07:00`);

describe('formatReference (F-04, BR-10)', () => {
  it('UNIT-03: formats BK-YYYY-NNNNNN and throws when the sequence exceeds 999999', () => {
    expect(formatReference(2026, 15)).toBe('BK-2026-000016');
    expect(formatReference(2026, 999_999)).toBe('BK-2026-999999');
    expect(formatReference(2026, 15)).toMatch(/^BK-\d{4}-\d{6}$/);
    expect(() => formatReference(2026, 1_234_567)).toThrow();
  });
});

describe('isBookable / checkCustomerLimits (F-04, BR-02, BR-03, BR-04)', () => {
  const slot = (startMin: number, status: 'OPEN' | 'CLOSED' | 'CANCELLED' = 'OPEN', isActive = true) =>
    ({ startAt: plus(startMin), endAt: plus(startMin + 30), status, service: { isActive } });
  const booking = (start: string, end: string, status: 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' = 'BOOKED', day?: string) =>
    ({ status, slot: { startAt: at(start, day), endAt: at(end, day) } });
  const target = { startAt: at('10:00'), endAt: at('10:30') };

  it('UNIT-04: +60 min is bookable; +59 min, CLOSED/CANCELLED and inactive service are not; 3 active → limit; past/cancelled not counted; overlap vs back-to-back', () => {
    expect(BOOKING_LEAD_MIN).toBe(60);
    expect(MAX_ACTIVE_BOOKINGS).toBe(3);

    expect(isBookable(slot(60), NOW)).toBeNull();
    expect(isBookable(slot(59), NOW)).toBe('SLOT_NOT_BOOKABLE');
    expect(isBookable(slot(120, 'CLOSED'), NOW)).toBe('SLOT_NOT_BOOKABLE');
    expect(isBookable(slot(120, 'CANCELLED'), NOW)).toBe('SLOT_NOT_BOOKABLE');
    expect(isBookable(slot(120, 'OPEN', false), NOW)).toBe('SLOT_NOT_BOOKABLE');

    const two = [booking('08:00', '08:30', 'BOOKED', '2026-11-13'), booking('09:00', '09:30', 'BOOKED', '2026-11-13')];
    expect(checkCustomerLimits(two, target)).toBeNull(); // the third booking is allowed
    const three = [...two, booking('11:00', '11:30', 'BOOKED', '2026-11-13')];
    expect(checkCustomerLimits(three, target)).toBe('BOOKING_LIMIT_REACHED');
    // Cancelled and finished (past) bookings are not active: two active + those → still allowed.
    expect(checkCustomerLimits([...two, booking('11:00', '11:30', 'CANCELLED'), booking('12:00', '12:30', 'COMPLETED'), booking('13:00', '13:30', 'NO_SHOW')], target)).toBeNull();

    expect(checkCustomerLimits([booking('10:15', '10:45')], target)).toBe('BOOKING_OVERLAP');
    expect(checkCustomerLimits([booking('09:45', '10:15')], target)).toBe('BOOKING_OVERLAP');
    expect(checkCustomerLimits([booking('09:30', '10:00'), booking('10:30', '11:00')], target)).toBeNull(); // back-to-back
    expect(checkCustomerLimits([booking('10:00', '10:30', 'CANCELLED')], target)).toBeNull();
    // BR-03 is checked before BR-04 (F-04 §1 step 4).
    expect(checkCustomerLimits([...two, booking('10:00', '10:30')], target)).toBe('BOOKING_LIMIT_REACHED');
  });
});

describe('canCustomerCancel (F-05, BR-05, BR-13)', () => {
  const slotIn = (min: number) => ({ startAt: plus(min) });

  it('UNIT-05: +120 min → allowed; +119 min → CANCELLATION_WINDOW_CLOSED; CANCELLED/COMPLETED/NO_SHOW → BOOKING_NOT_ACTIVE, checked first', () => {
    expect(CANCEL_WINDOW_MIN).toBe(120);
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(120), NOW)).toBeNull();
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(24 * 60), NOW)).toBeNull();
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(119), NOW)).toBe('CANCELLATION_WINDOW_CLOSED');
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(-30), NOW)).toBe('CANCELLATION_WINDOW_CLOSED');
    for (const status of ['CANCELLED', 'COMPLETED', 'NO_SHOW'] as const) {
      expect(canCustomerCancel({ status }, slotIn(24 * 60), NOW)).toBe('BOOKING_NOT_ACTIVE');
      expect(canCustomerCancel({ status }, slotIn(30), NOW)).toBe('BOOKING_NOT_ACTIVE'); // BR-13 before BR-05
    }
  });
});
