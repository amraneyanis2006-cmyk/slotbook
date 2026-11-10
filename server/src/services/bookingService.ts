import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { BOOKING_LEAD_MIN, BOOKING_RULE_MESSAGES, canCustomerCancel, checkCustomerLimits, formatReference, isBookable } from '../rules/bookingRules.js';
import { now } from '../utils/clock.js';
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
 * Books slotId for customerId (from the session) in one transaction, in the binding order of F-04 §1 step 4.
 * A race lost on the partial unique index (P2002) is answered 409 SLOT_ALREADY_BOOKED by the error handler.
 */
export function book(customerId: number, slotId: number, note: string | null) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Slot" WHERE id = ${slotId} FOR UPDATE`;
    if (!locked.length) throw new AppError(404, 'NOT_FOUND', 'Slot not found.');
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${customerId} FOR UPDATE`;

    const at = now();
    const slot = await tx.slot.findUniqueOrThrow({
      where: { id: slotId },
      include: { service: true, bookings: { where: { status: 'BOOKED' }, select: { id: true } } },
    });
    if (isBookable(slot, at)) throw reject('SLOT_NOT_BOOKABLE');
    if (slot.bookings.length) throw reject('SLOT_ALREADY_BOOKED');

    const activeFuture = await tx.booking.findMany({
      where: { customerId, status: 'BOOKED', slot: { startAt: { gt: at } } },
      select: { status: true, slot: { select: { startAt: true, endAt: true } } },
    });
    const limit = checkCustomerLimits(activeFuture, slot);
    if (limit) throw reject(limit);

    const [{ seq }] = await tx.$queryRaw<{ seq: bigint }[]>`SELECT nextval('booking_ref_seq') AS seq`;
    return tx.booking.create({
      data: { slotId, customerId, note, createdAt: at, reference: formatReference(Number(bangkokDate(at).slice(0, 4)), Number(seq)) },
      select: BOOKING_VIEW_SELECT,
    });
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

/** One of the caller's bookings by reference (case-insensitive in the URL); 404 when missing or not owned. */
export async function getMine(customerId: number, reference: string) {
  const booking = await prisma.booking.findFirst({ where: { reference: reference.toUpperCase(), customerId }, select: BOOKING_VIEW_SELECT });
  if (!booking) throw bookingNotFound();
  return booking;
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
    return tx.booking.update({
      where: { id: locked.id },
      data: { status: 'CANCELLED', cancelledAt: at, cancelledById: customerId },
      select: BOOKING_VIEW_SELECT,
    });
  });
}
