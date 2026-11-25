import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { BOOKING_LEAD_MIN, BOOKING_RULE_MESSAGES, canCustomerCancel, canRecordOutcome, checkCustomerLimits, checkRescheduleTarget, formatReference, isBookable } from '../rules/bookingRules.js';
import { MAX_SEARCH_RESULTS, type SearchQuery } from '../rules/searchRules.js';
import { now } from '../utils/clock.js';
import { getHistory, recordStatusChange } from './historyService.js';
import { addDays, bangkokDate, bangkokToUtc } from '../utils/time.js';

const SERVICE_SELECT = { select: { id: true, name: true, durationMin: true } } as const;
const STAFF_SELECT = { select: { id: true, name: true } } as const;

/** SlotPublicView (F-04 §3): never any customer data. */
const SLOT_PUBLIC_SELECT = {
  id: true, startAt: true, endAt: true, service: SERVICE_SELECT, staff: STAFF_SELECT,
} satisfies Prisma.SlotSelect;

/** BookingView (F-04 §3). */
export const BOOKING_VIEW_SELECT = {
  reference: true, status: true, note: true, createdAt: true, cancelledAt: true, slot: { select: SLOT_PUBLIC_SELECT },
} satisfies Prisma.BookingSelect;

/** Drops the internal id selected for the history writer/reader: BookingView never exposes it. */
const withoutId = <T extends { id: number }>({ id: _id, ...view }: T) => view;
const reject = (code: keyof typeof BOOKING_RULE_MESSAGES) => new AppError(409, code, BOOKING_RULE_MESSAGES[code]);
// Missing and not owned are answered the same way (BR-09).
const bookingNotFound = () => new AppError(404, 'NOT_FOUND', 'Booking not found.');

/** Bookable slots of one Bangkok day (F-04 §3), ordered by start then id. */
export function listAvailable(date: string, serviceId?: number) {
  const earliest = new Date(now().getTime() + BOOKING_LEAD_MIN * 60_000);
  const dayStart = bangkokToUtc(date, '00:00');
  return prisma.slot.findMany({
    where: {
      status: 'OPEN',
      startAt: { gte: earliest > dayStart ? earliest : dayStart, lt: bangkokToUtc(addDays(date, 1), '00:00') },
      service: { isActive: true, id: serviceId },
      bookings: { none: { status: 'BOOKED' } },
    },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    select: SLOT_PUBLIC_SELECT,
  });
}

/**
 * F-12 §1 step 2: the F-04 bookability conditions plus an active staff member, Bangkok dates from..to inclusive,
 * optional service/staff filters, ordered by start then id; at most 200 with `truncated`.
 */
export async function searchSlots({ from, to, serviceId, staffId }: SearchQuery) {
  const earliest = new Date(now().getTime() + BOOKING_LEAD_MIN * 60_000);
  const rangeStart = bangkokToUtc(from, '00:00');
  const slots = await prisma.slot.findMany({
    where: {
      status: 'OPEN',
      startAt: { gte: earliest > rangeStart ? earliest : rangeStart, lt: bangkokToUtc(addDays(to, 1), '00:00') },
      service: { isActive: true, id: serviceId },
      staff: { isActive: true, role: 'STAFF', id: staffId },
      bookings: { none: { status: 'BOOKED' } },
    },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    take: MAX_SEARCH_RESULTS + 1,
    select: SLOT_PUBLIC_SELECT,
  });
  return { slots: slots.slice(0, MAX_SEARCH_RESULTS), truncated: slots.length > MAX_SEARCH_RESULTS };
}

/**
 * Books slotId for customerId (from the session) inside `tx`, in the binding order of F-04 §1 step 4, and appends the
 * creation history row (F-10). Shared by F-04 (book) and F-08 (reschedule), so both apply the same rules.
 * A race lost on the partial unique index (P2002) is answered 409 SLOT_ALREADY_BOOKED by the error handler.
 */
async function bookInTx(tx: Prisma.TransactionClient, customerId: number, slotId: number, note: string | null, at: Date, reason: string | null = null) {
  const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Slot" WHERE id = ${slotId} FOR UPDATE`;
  if (!locked.length) throw new AppError(404, 'NOT_FOUND', 'Slot not found.');
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${customerId} FOR UPDATE`;

  const slot = await tx.slot.findUniqueOrThrow({
    where: { id: slotId },
    include: { service: true, bookings: { where: { status: 'BOOKED' }, select: { id: true } } },
  });
  if (isBookable(slot, at)) throw reject('SLOT_NOT_BOOKABLE');
  if (slot.bookings.length) throw reject('SLOT_ALREADY_BOOKED');

  // Not yet ended (A-04): a booking that has started still counts for BR-04, not for BR-03 (checkCustomerLimits).
  const notEnded = await tx.booking.findMany({
    where: { customerId, status: 'BOOKED', slot: { endAt: { gt: at } } },
    select: { status: true, slot: { select: { startAt: true, endAt: true } } },
  });
  const limit = checkCustomerLimits(notEnded, slot, at);
  if (limit) throw reject(limit);

  const [{ seq }] = await tx.$queryRaw<{ seq: bigint }[]>`SELECT nextval('booking_ref_seq') AS seq`;
  const booking = await tx.booking.create({
    data: { slotId, customerId, note, createdAt: at, reference: formatReference(Number(bangkokDate(at).slice(0, 4)), Number(seq)) },
    select: { id: true, ...BOOKING_VIEW_SELECT },
  });
  await recordStatusChange(tx, { bookingId: booking.id, from: null, to: 'BOOKED', actorId: customerId, reason, at });
  return booking;
}

/** F-04: books a slot for the session customer in one transaction. */
export function book(customerId: number, slotId: number, note: string | null) {
  return prisma.$transaction(async (tx) => withoutId(await bookInTx(tx, customerId, slotId, note, now())));
}

/**
 * F-08 §1 step 3, one transaction (BR-16): lock the caller's booking (404), BR-13 and BR-05 on it, check the target
 * (404 / 422), cancel the old booking, then book the target with the F-04 rules (the old booking, already cancelled,
 * is excluded from BR-03/BR-04). Any refusal rolls everything back.
 */
export function reschedule(customerId: number, reference: string, slotId: number) {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Booking" WHERE reference = ${reference.toUpperCase()} AND "customerId" = ${customerId} FOR UPDATE`;
    if (!locked) throw bookingNotFound();
    const at = now();
    const old = await tx.booking.findUniqueOrThrow({
      where: { id: locked.id }, select: { reference: true, status: true, note: true, slot: { select: { id: true, serviceId: true, startAt: true } } },
    });
    const refusal = canCustomerCancel(old, old.slot, at);
    if (refusal) throw reject(refusal);
    const target = await tx.slot.findUnique({ where: { id: slotId }, select: { id: true, serviceId: true } });
    if (!target) throw new AppError(404, 'NOT_FOUND', 'Slot not found.');
    const wrongTarget = checkRescheduleTarget(old.slot, target);
    if (wrongTarget) throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', wrongTarget);

    await tx.booking.update({ where: { id: locked.id }, data: { status: 'CANCELLED', cancelledAt: at, cancelledById: customerId } });
    const fresh = await bookInTx(tx, customerId, slotId, old.note, at, `Rescheduled from ${old.reference}`);
    await recordStatusChange(tx, {
      bookingId: locked.id, from: 'BOOKED', to: 'CANCELLED', actorId: customerId, reason: `Rescheduled to ${fresh.reference}`, at,
    });
    return { booking: withoutId(fresh), previous: old.reference };
  });
}

/** The caller's bookings (F-05 §1): upcoming = BOOKED with start ≥ now (ascending), past = the rest (newest start first). */
export async function listMine(customerId: number) {
  const at = now();
  const bookings = await prisma.booking.findMany({
    where: { customerId },
    orderBy: [{ slot: { startAt: 'asc' } }, { id: 'asc' }],
    select: BOOKING_VIEW_SELECT,
  });
  const isUpcoming = (b: (typeof bookings)[number]) => b.status === 'BOOKED' && b.slot.startAt >= at;
  return { upcoming: bookings.filter(isUpcoming), past: bookings.filter((b) => !isUpcoming(b)).reverse() };
}

/** One of the caller's bookings by reference (case-insensitive in the URL) with its history; 404 when missing or not owned. */
export async function getMine(customerId: number, reference: string) {
  const booking = await prisma.booking.findFirst({ where: { reference: reference.toUpperCase(), customerId }, select: { id: true, ...BOOKING_VIEW_SELECT } });
  if (!booking) throw bookingNotFound();
  return { booking: withoutId(booking), history: await getHistory(booking.id) };
}

/** A booking on one of the caller's slots (F-10 §3, StaffBookingView) with its history; 404 when missing or another staff member's. */
export async function getForStaff(staffId: number, reference: string) {
  const booking = await prisma.booking.findFirst({
    where: { reference: reference.toUpperCase(), slot: { staffId } },
    select: { id: true, ...BOOKING_VIEW_SELECT, customer: { select: { id: true, name: true } } },
  });
  if (!booking) throw bookingNotFound();
  return { booking: withoutId(booking), history: await getHistory(booking.id) };
}

/** Cancels the caller's booking in one transaction with its row locked (F-05 §1 step 4): BR-09, BR-13, BR-05. */
export function cancel(customerId: number, reference: string) {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Booking" WHERE reference = ${reference.toUpperCase()} AND "customerId" = ${customerId} FOR UPDATE`;
    if (!locked) throw bookingNotFound();
    const at = now();
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: locked.id }, select: { status: true, slot: { select: { startAt: true } } } });
    const refusal = canCustomerCancel(booking, booking.slot, at);
    if (refusal) throw reject(refusal);
    await recordStatusChange(tx, { bookingId: locked.id, from: 'BOOKED', to: 'CANCELLED', actorId: customerId, at });
    return tx.booking.update({
      where: { id: locked.id },
      data: { status: 'CANCELLED', cancelledAt: at, cancelledById: customerId },
      select: BOOKING_VIEW_SELECT,
    });
  });
}

/**
 * F-09 §1 step 3: locks the booking of one of the caller's slots (missing or another staff member's → 404), checks
 * BR-13 then BR-15, sets the outcome and appends its history row, in one transaction.
 */
export async function recordOutcome(staffId: number, reference: string, outcome: 'COMPLETED' | 'NO_SHOW') {
  await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: number }[]>`
      SELECT b.id FROM "Booking" b JOIN "Slot" s ON s.id = b."slotId"
      WHERE b.reference = ${reference.toUpperCase()} AND s."staffId" = ${staffId} FOR UPDATE OF b`;
    if (!locked) throw bookingNotFound();
    const at = now();
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: locked.id }, select: { status: true, slot: { select: { startAt: true } } } });
    const refusal = canRecordOutcome(booking, booking.slot, at);
    if (refusal) throw reject(refusal);
    await tx.booking.update({ where: { id: locked.id }, data: { status: outcome } });
    await recordStatusChange(tx, { bookingId: locked.id, from: 'BOOKED', to: outcome, actorId: staffId, at });
  });
  return getForStaff(staffId, reference);
}
