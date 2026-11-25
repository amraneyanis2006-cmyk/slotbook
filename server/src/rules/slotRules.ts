// Pure slot rules (F-03 §2). Times are Asia/Bangkok local input; results are UTC instants.
import type { SlotStatus } from '@prisma/client';
import { bangkokToUtc, isIsoDate } from '../utils/time.js';

export type SlotInput = { serviceId: number; date: string; startTime: string };
export type SlotService = { durationMin: number; isActive: boolean } | null;
export type TimeRange = { startAt: Date; endAt: Date };

const OPEN_MIN = 8 * 60;
const CLOSE_MIN = 18 * 60;

/**
 * BR-06 in binding order: a (service) and b (format) first, then c (future), then d (opening hours).
 * Returns the computed range, or one message per field (for startTime only the first failing check).
 */
export function validateSlot(input: SlotInput, service: SlotService, now: Date): TimeRange | { fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  if (!service?.isActive) fields.serviceId = 'Choose an active service.';
  if (!isIsoDate(input.date)) fields.date = 'Enter a valid date (YYYY-MM-DD).';
  const time = /^([01]\d|2[0-3]):(00|15|30|45)$/.exec(input.startTime);
  if (!time) fields.startTime = 'Choose a start time on a 15-minute step (HH:mm).';
  if (Object.keys(fields).length || !service || !time) return { fields };

  const startAt = bangkokToUtc(input.date, input.startTime);
  const endAt = new Date(startAt.getTime() + service.durationMin * 60_000);
  const startMin = Number(time[1]) * 60 + Number(time[2]);
  if (startAt <= now) return { fields: { startTime: 'The slot must start in the future.' } };
  if (startMin < OPEN_MIN || startMin + service.durationMin > CLOSE_MIN) {
    return { fields: { startTime: 'Slots must be within opening hours (08:00–18:00).' } };
  }
  return { startAt, endAt };
}

/** Half-open ranges: touching edges do not overlap. */
export const overlaps = (a: TimeRange, b: TimeRange): boolean => a.startAt < b.endAt && b.startAt < a.endAt;

/** BR-07: first non-cancelled existing slot overlapping the new one, or null. */
export const findOverlap = <T extends TimeRange & { status: SlotStatus }>(slot: TimeRange, existing: T[]): T | null =>
  existing.find((s) => s.status !== 'CANCELLED' && overlaps(slot, s)) ?? null;

export type SlotAction = 'edit' | 'close' | 'reopen' | 'cancel';

/**
 * F-07 §2 in binding order: SLOT_NOT_EDITABLE (cancelled, started, close of a non-OPEN or reopen of a non-CLOSED slot)
 * before SLOT_HAS_BOOKING (BR-14: a booked slot can only be cancelled).
 */
export function checkSlotChange(action: SlotAction, slot: { status: SlotStatus; startAt: Date }, hasBooking: boolean, now: Date):
  null | 'SLOT_NOT_EDITABLE' | 'SLOT_HAS_BOOKING' {
  if (slot.status === 'CANCELLED' || slot.startAt <= now) return 'SLOT_NOT_EDITABLE';
  if (action === 'close' && slot.status !== 'OPEN') return 'SLOT_NOT_EDITABLE';
  if (action === 'reopen' && slot.status !== 'CLOSED') return 'SLOT_NOT_EDITABLE';
  if (hasBooking && (action === 'edit' || action === 'close')) return 'SLOT_HAS_BOOKING';
  return null;
}
