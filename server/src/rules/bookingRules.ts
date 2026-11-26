// Pure booking rules (F-04 §2), unit-tested with a fixed clock.
import type { BookingStatus, SlotStatus } from '@prisma/client';
import { overlaps, type TimeRange } from './slotRules.js';

export const BOOKING_LEAD_MIN = 60;
export const MAX_ACTIVE_BOOKINGS = 3;
export const CANCEL_WINDOW_MIN = 24 * 60; // BR-05 v2 (CR-01): 24 h; was 120 min in Sprint 1

/** User messages of the 409 booking rule errors (system-sds §4). */
export const BOOKING_RULE_MESSAGES = {
  SLOT_NOT_BOOKABLE: 'This slot can no longer be booked.',
  SLOT_ALREADY_BOOKED: 'This slot has already been booked.',
  BOOKING_LIMIT_REACHED: 'You already have 3 upcoming bookings, the maximum.',
  BOOKING_OVERLAP: 'You already have a booking at this time.',
  BOOKING_NOT_ACTIVE: 'This booking is no longer active.',
  CANCELLATION_WINDOW_CLOSED: 'Cancellation closes 24 hours before the start.',
  OUTCOME_TOO_EARLY: 'An outcome can be recorded only after the booking starts.',
} as const;

export type BookableSlot = TimeRange & { status: SlotStatus; service: { isActive: boolean } };
export type CustomerBooking = { status: BookingStatus; slot: TimeRange };

/** BR-02: OPEN, active service and start ≥ now + 60 min. */
export const isBookable = (slot: BookableSlot, now: Date): null | 'SLOT_NOT_BOOKABLE' =>
  slot.status === 'OPEN' && slot.service.isActive && slot.startAt.getTime() >= now.getTime() + BOOKING_LEAD_MIN * 60_000
    ? null
    : 'SLOT_NOT_BOOKABLE';

/**
 * BR-03 then BR-04 against the customer's active bookings that have not ended (the service selects BOOKED with
 * end > now; only BOOKED entries count here, so cancelled or finished bookings never block). BR-03 counts only
 * bookings that start after now; BR-04 also counts one that has started (A-04, resolved by F-11 §1 step 6).
 */
export function checkCustomerLimits(activeBookings: CustomerBooking[], slot: TimeRange, now: Date): null | 'BOOKING_LIMIT_REACHED' | 'BOOKING_OVERLAP' {
  const active = activeBookings.filter((b) => b.status === 'BOOKED');
  if (active.filter((b) => b.slot.startAt > now).length >= MAX_ACTIVE_BOOKINGS) return 'BOOKING_LIMIT_REACHED';
  return active.some((b) => overlaps(b.slot, slot)) ? 'BOOKING_OVERLAP' : null;
}

/** BR-13 first (only BOOKED changes), then BR-05 v2 (start − now ≥ 24 h; exactly 24 h is allowed). */
export function canCustomerCancel(booking: { status: BookingStatus }, slot: { startAt: Date }, now: Date): null | 'BOOKING_NOT_ACTIVE' | 'CANCELLATION_WINDOW_CLOSED' {
  if (booking.status !== 'BOOKED') return 'BOOKING_NOT_ACTIVE';
  return slot.startAt.getTime() - now.getTime() >= CANCEL_WINDOW_MIN * 60_000 ? null : 'CANCELLATION_WINDOW_CLOSED';
}

const DAY_MS = 24 * 3_600_000;
/**
 * BR-19 (F-17 §2): NO_SHOW times within (now − 30 days, now]; for each window of 3 consecutive ones the suspension
 * ends 7 days after the third; returns the latest end that is after now, else null.
 */
export function suspendedUntil(noShowTimes: Date[], now: Date): Date | null {
  const recent = noShowTimes.filter((t) => t.getTime() > now.getTime() - 30 * DAY_MS && t <= now).sort((a, b) => a.getTime() - b.getTime());
  let end: Date | null = null;
  for (let i = 2; i < recent.length; i++) {
    const e = new Date(recent[i].getTime() + 7 * DAY_MS);
    if (e > now && (!end || e > end)) end = e;
  }
  return end;
}

/** F-09 §2: BR-13 first (only BOOKED), then BR-15 (now ≥ start; exactly at the start is allowed). */
export function canRecordOutcome(booking: { status: BookingStatus }, slot: { startAt: Date }, now: Date): null | 'BOOKING_NOT_ACTIVE' | 'OUTCOME_TOO_EARLY' {
  if (booking.status !== 'BOOKED') return 'BOOKING_NOT_ACTIVE';
  return now >= slot.startAt ? null : 'OUTCOME_TOO_EARLY';
}

/** F-08 §2: the target must be another slot of the same service (422 on `slotId`). */
export function checkRescheduleTarget(oldSlot: { id: number; serviceId: number }, newSlot: { id: number; serviceId: number }): null | { slotId: string } {
  if (newSlot.id === oldSlot.id) return { slotId: 'Choose a different slot.' };
  return newSlot.serviceId === oldSlot.serviceId ? null : { slotId: 'Choose a slot of the same service.' };
}

/** BR-10 booking reference: BK-<Bangkok year>-<6-digit sequence>; throws above 999999. */
export const formatReference = (year: number, seq: number): string => {
  if (!Number.isInteger(seq) || seq < 1 || seq > 999_999) throw new RangeError(`Booking sequence out of range: ${seq}`);
  return `BK-${year}-${String(seq).padStart(6, '0')}`;
};
