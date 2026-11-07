import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { findOverlap, validateSlot, type SlotInput } from '../rules/slotRules.js';
import { now } from '../utils/clock.js';

const SLOT_STAFF_INCLUDE = {
  service: { select: { id: true, name: true, durationMin: true } },
  bookings: { where: { status: 'BOOKED' }, take: 1, select: { reference: true, status: true, customer: { select: { id: true, name: true } } } },
} satisfies Prisma.SlotInclude;

type SlotWithBooking = Prisma.SlotGetPayload<{ include: typeof SLOT_STAFF_INCLUDE }>;

/** SlotStaffView of F-03 §3. */
export const toSlotStaffView = ({ id, startAt, endAt, status, service, bookings }: SlotWithBooking) =>
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
