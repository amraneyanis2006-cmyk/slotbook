// Pure booking rules (F-04 §2), unit-tested with a fixed clock.
import type { BookingStatus, SlotStatus } from '@prisma/client';
import { overlaps, type TimeRange } from './slotRules.js';

export const BOOKING_LEAD_MIN = 60;
export const MAX_ACTIVE_BOOKINGS = 3;
export const CANCEL_WINDOW_MIN = 120;

/** User messages of the 409 booking rule errors (system-sds §4). */
export const BOOKING_RULE_MESSAGES = {
  SLOT_NOT_BOOKABLE: 'This slot can no longer be booked.',
  SLOT_ALREADY_BOOKED: 'This slot has already been booked.',
  BOOKING_LIMIT_REACHED: 'You already have 3 upcoming bookings, the maximum.',
  BOOKING_OVERLAP: 'You already have a booking at this time.',
  BOOKING_NOT_ACTIVE: 'This booking is no longer active.',
  CANCELLATION_WINDOW_CLOSED: 'Cancellation closes 2 hours before the start.',
} as const;

export type BookableSlot = TimeRange & { status: SlotStatus; service: { isActive: boolean } };
export type CustomerBooking = { status: BookingStatus; slot: TimeRange };

/** BR-02: OPEN, active service and start ≥ now + 60 min. */
export const isBookable = (slot: BookableSlot, now: Date): null | 'SLOT_NOT_BOOKABLE' =>
  slot.status === 'OPEN' && slot.service.isActive && slot.startAt.getTime() >= now.getTime() + BOOKING_LEAD_MIN * 60_000
    ? null
    : 'SLOT_NOT_BOOKABLE';

/**
 * BR-03 then BR-04 against the customer's active future bookings (the service selects BOOKED with start > now;
 * only BOOKED entries count here, so cancelled or finished bookings never block).
 */
export function checkCustomerLimits(activeFutureBookings: CustomerBooking[], slot: TimeRange): null | 'BOOKING_LIMIT_REACHED' | 'BOOKING_OVERLAP' {
  const active = activeFutureBookings.filter((b) => b.status === 'BOOKED');
  if (active.length >= MAX_ACTIVE_BOOKINGS) return 'BOOKING_LIMIT_REACHED';
  return active.some((b) => overlaps(b.slot, slot)) ? 'BOOKING_OVERLAP' : null;
}

/** BR-13 first (only BOOKED changes), then BR-05 (start − now ≥ 120 min; exactly 120 is allowed). */
export function canCustomerCancel(booking: { status: BookingStatus }, slot: { startAt: Date }, now: Date): null | 'BOOKING_NOT_ACTIVE' | 'CANCELLATION_WINDOW_CLOSED' {
  if (booking.status !== 'BOOKED') return 'BOOKING_NOT_ACTIVE';
  return slot.startAt.getTime() - now.getTime() >= CANCEL_WINDOW_MIN * 60_000 ? null : 'CANCELLATION_WINDOW_CLOSED';
}

/** BR-10 booking reference: BK-<Bangkok year>-<6-digit sequence>; throws above 999999. */
export const formatReference = (year: number, seq: number): string => {
  if (!Number.isInteger(seq) || seq < 1 || seq > 999_999) throw new RangeError(`Booking sequence out of range: ${seq}`);
  return `BK-${year}-${String(seq).padStart(6, '0')}`;
};
