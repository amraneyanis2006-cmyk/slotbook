import { describe, expect, it } from 'vitest';
import { BOOKING_LEAD_MIN, CANCEL_WINDOW_MIN, MAX_ACTIVE_BOOKINGS, canCustomerCancel, checkCustomerLimits, formatReference, isBookable } from '../../src/rules/bookingRules.js';

const NOW = new Date('2026-11-10T08:00:00+07:00');
const plus = (min: number) => new Date(NOW.getTime() + min * 60_000);
const at = (hhmm: string, day = '2026-11-12') => new Date(`${day}T${hhmm}:00+07:00`);

describe('formatReference (F-04, BR-10)', () => {
  it('UNIT-03: formats BK-YYYY-NNNNNN and throws when the sequence exceeds 999999', () => {
    expect(formatReference(2026, 15)).toBe('BK-2026-000015');
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
    expect(checkCustomerLimits(two, target, NOW)).toBeNull(); // the third booking is allowed
    const three = [...two, booking('11:00', '11:30', 'BOOKED', '2026-11-13')];
    expect(checkCustomerLimits(three, target, NOW)).toBe('BOOKING_LIMIT_REACHED');
    // Cancelled and finished (past) bookings are not active: two active + those → still allowed.
    expect(checkCustomerLimits([...two, booking('11:00', '11:30', 'CANCELLED'), booking('12:00', '12:30', 'COMPLETED'), booking('13:00', '13:30', 'NO_SHOW')], target, NOW)).toBeNull();

    expect(checkCustomerLimits([booking('10:15', '10:45')], target, NOW)).toBe('BOOKING_OVERLAP');
    expect(checkCustomerLimits([booking('09:45', '10:15')], target, NOW)).toBe('BOOKING_OVERLAP');
    expect(checkCustomerLimits([booking('09:30', '10:00'), booking('10:30', '11:00')], target, NOW)).toBeNull(); // back-to-back
    expect(checkCustomerLimits([booking('10:00', '10:30', 'CANCELLED')], target, NOW)).toBeNull();
    // A-04 (F-11 §1 step 6): a booking that has started still blocks an overlap but no longer counts towards BR-03.
    const ongoing = { status: 'BOOKED' as const, slot: { startAt: plus(-30), endAt: plus(90) } };
    expect(checkCustomerLimits([ongoing], { startAt: plus(60), endAt: plus(90) }, NOW)).toBe('BOOKING_OVERLAP');
    expect(checkCustomerLimits([...two, ongoing], { startAt: plus(90), endAt: plus(120) }, NOW)).toBeNull();
    // BR-03 is checked before BR-04 (F-04 §1 step 4).
    expect(checkCustomerLimits([...two, booking('10:00', '10:30')], target, NOW)).toBe('BOOKING_LIMIT_REACHED');
  });
});

describe('canCustomerCancel (F-05, BR-05, BR-13)', () => {
  const slotIn = (min: number) => ({ startAt: plus(min) });

  it('UNIT-05 (CR-01): +1440 min → allowed; +1439, +180 and +120 min → CANCELLATION_WINDOW_CLOSED; CANCELLED/COMPLETED/NO_SHOW → BOOKING_NOT_ACTIVE, checked first', () => {
    expect(CANCEL_WINDOW_MIN).toBe(24 * 60);
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(24 * 60), NOW)).toBeNull(); // exactly 24 h: allowed
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(72 * 60), NOW)).toBeNull();
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(24 * 60 - 1), NOW)).toBe('CANCELLATION_WINDOW_CLOSED'); // 23 h 59 min
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(180), NOW)).toBe('CANCELLATION_WINDOW_CLOSED'); // allowed before CR-01
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(120), NOW)).toBe('CANCELLATION_WINDOW_CLOSED'); // old boundary
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(119), NOW)).toBe('CANCELLATION_WINDOW_CLOSED');
    expect(canCustomerCancel({ status: 'BOOKED' }, slotIn(-30), NOW)).toBe('CANCELLATION_WINDOW_CLOSED');
    for (const status of ['CANCELLED', 'COMPLETED', 'NO_SHOW'] as const) {
      expect(canCustomerCancel({ status }, slotIn(24 * 60), NOW)).toBe('BOOKING_NOT_ACTIVE');
      expect(canCustomerCancel({ status }, slotIn(30), NOW)).toBe('BOOKING_NOT_ACTIVE'); // BR-13 before BR-05
    }
  });
});

describe('canRecordOutcome (F-09 §2, BR-15, BR-13)', () => {
  it('UNIT-12: before the start → OUTCOME_TOO_EARLY; at the start and later → null; non-BOOKED → BOOKING_NOT_ACTIVE, checked first', async () => {
    const { canRecordOutcome } = await import('../../src/rules/bookingRules.js');
    const slotAt = (min: number) => ({ startAt: plus(min) });
    expect(canRecordOutcome({ status: 'BOOKED' }, slotAt(1), NOW)).toBe('OUTCOME_TOO_EARLY');
    expect(canRecordOutcome({ status: 'BOOKED' }, slotAt(0), NOW)).toBeNull();
    expect(canRecordOutcome({ status: 'BOOKED' }, slotAt(-180), NOW)).toBeNull();
    for (const status of ['CANCELLED', 'COMPLETED', 'NO_SHOW'] as const) {
      expect(canRecordOutcome({ status }, slotAt(-30), NOW)).toBe('BOOKING_NOT_ACTIVE');
      expect(canRecordOutcome({ status }, slotAt(30), NOW)).toBe('BOOKING_NOT_ACTIVE');
    }
  });
});

describe('checkRescheduleTarget (F-08 §2)', () => {
  it('UNIT-13: same slot → "Choose a different slot."; other service → same-service message; valid target → null', async () => {
    const { checkRescheduleTarget } = await import('../../src/rules/bookingRules.js');
    const old = { id: 10, serviceId: 1 };
    expect(checkRescheduleTarget(old, { id: 10, serviceId: 1 })).toEqual({ slotId: 'Choose a different slot.' });
    expect(checkRescheduleTarget(old, { id: 11, serviceId: 2 })).toEqual({ slotId: 'Choose a slot of the same service.' });
    expect(checkRescheduleTarget(old, { id: 11, serviceId: 1 })).toBeNull();
  });
});

describe('suspendedUntil (F-17 §2, BR-19)', () => {
  it('UNIT-18: third no-show within 30 days + 7 days while that is after now; only the last 30 days count; null otherwise', async () => {
    const { suspendedUntil } = await import('../../src/rules/bookingRules.js');
    const day = 24 * 60; // minutes
    const ago = (minutes: number) => plus(-minutes);
    // three in the last 30 days, third 2 days ago → suspended until third + 7 days
    expect(suspendedUntil([ago(20 * day), ago(10 * day), ago(2 * day)], NOW)).toEqual(new Date(ago(2 * day).getTime() + 7 * day * 60_000));
    expect(suspendedUntil([ago(2 * day), ago(20 * day), ago(10 * day)], NOW)).toEqual(new Date(ago(2 * day).getTime() + 7 * day * 60_000)); // order-free
    expect(suspendedUntil([ago(10 * day), ago(2 * day)], NOW)).toBeNull(); // only two
    expect(suspendedUntil([ago(30 * day), ago(10 * day), ago(2 * day)], NOW)).toBeNull(); // exactly 30 days ago is excluded
    expect(suspendedUntil([ago(29 * day), ago(10 * day), ago(2 * day)], NOW)).not.toBeNull();
    expect(suspendedUntil([ago(20 * day), ago(15 * day), ago(7 * day)], NOW)).toBeNull(); // 7 days over to the minute
    expect(suspendedUntil([ago(20 * day), ago(15 * day), ago(7 * day - 1)], NOW)).toEqual(plus(1));
    // four no-shows: the latest window of three gives the latest end
    expect(suspendedUntil([ago(25 * day), ago(20 * day), ago(12 * day), ago(1 * day)], NOW)).toEqual(new Date(ago(1 * day).getTime() + 7 * day * 60_000));
    expect(suspendedUntil([], NOW)).toBeNull();
  });
});

