import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { findOverlap, validateSlot, type SlotInput } from '../rules/slotRules.js';
import { now } from '../utils/clock.js';
import { addDays, bangkokToUtc } from '../utils/time.js';

const SLOT_STAFF_INCLUDE = {
  service: { select: { id: true, name: true, durationMin: true } },
  bookings: { where: { status: 'BOOKED' }, take: 1, select: { reference: true, status: true, customer: { select: { id: true, name: true } } } },
} satisfies Prisma.SlotInclude;

// F-06: the schedule shows the BOOKED, COMPLETED or NO_SHOW booking of a slot (never a cancelled one), with its note.
const SCHEDULE_INCLUDE = {
  service: SLOT_STAFF_INCLUDE.service,
  bookings: {
    where: { status: { in: ['BOOKED', 'COMPLETED', 'NO_SHOW'] } }, take: 1,
    select: { reference: true, status: true, note: true, customer: { select: { id: true, name: true } } },
  },
} satisfies Prisma.SlotInclude;

type SlotWithBookings<B> = Prisma.SlotGetPayload<{ include: { service: typeof SLOT_STAFF_INCLUDE.service } }> & { bookings: B[] };

/** SlotStaffView of F-03 §3 (the schedule variant adds the booking note). */
export const toSlotStaffView = <B>({ id, startAt, endAt, status, service, bookings }: SlotWithBookings<B>) =>
  ({ id, startAt, endAt, status, service, booking: bookings[0] ?? null });

/** Creates an OPEN slot for staffId (from the session). BR-06 first, then BR-07 under a row lock on the staff user. */
export async function createSlot(staffId: number, input: SlotInput) {
  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  const range = validateSlot(input, service, now());
  if ('fields' in range) throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', range.fields);

  const slot = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${staffId} FOR UPDATE`;
    const nearby = await tx.slot.findMany({ where: { staffId, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } } });
    if (findOverlap(range, nearby)) throw new AppError(409, 'SLOT_OVERLAP', 'You already have a slot at this time.');
    return tx.slot.create({ data: { staffId, serviceId: input.serviceId, ...range }, include: SLOT_STAFF_INCLUDE });
  });
  return toSlotStaffView(slot);
}

/** Own slots with startAt ≥ now, not cancelled, ordered by start then id. */
export async function listUpcoming(staffId: number) {
  const slots = await prisma.slot.findMany({
    where: { staffId, status: { not: 'CANCELLED' }, startAt: { gte: now() } },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    include: SLOT_STAFF_INCLUDE,
  });
  return slots.map(toSlotStaffView);
}

/**
 * The caller's non-cancelled slots of one Bangkok day with their booking (F-06 §2). The summary counts are disjoint,
 * so total = booked + open + closed = number of slots: a slot with a booking is "booked" whatever its status.
 */
export async function getSchedule(staffId: number, date: string) {
  const slots = (await prisma.slot.findMany({
    where: { staffId, status: { not: 'CANCELLED' }, startAt: { gte: bangkokToUtc(date, '00:00'), lt: bangkokToUtc(addDays(date, 1), '00:00') } },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    include: SCHEDULE_INCLUDE,
  })).map(toSlotStaffView);
  const booked = slots.filter((s) => s.booking).length;
  const open = slots.filter((s) => !s.booking && s.status === 'OPEN').length;
  const closed = slots.filter((s) => !s.booking && s.status === 'CLOSED').length;
  return { date, slots, summary: { total: booked + open + closed, booked, open, closed } };
}
