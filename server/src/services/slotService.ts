import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { checkSlotChange, findOverlap, validateSlot, type SlotAction, type SlotInput } from '../rules/slotRules.js';
import { recordStatusChange } from './historyService.js';
import { now } from '../utils/clock.js';
import { addDays, bangkokToUtc } from '../utils/time.js';

export const SLOT_STAFF_INCLUDE = {
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
  const at = now();
  // F-09 §3: canRecordOutcome = BOOKED and started, so the client never compares clocks.
  const slots = (await prisma.slot.findMany({
    where: { staffId, status: { not: 'CANCELLED' }, startAt: { gte: bangkokToUtc(date, '00:00'), lt: bangkokToUtc(addDays(date, 1), '00:00') } },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    include: SCHEDULE_INCLUDE,
  })).map((slot) => ({
    ...slot, bookings: slot.bookings.map((b) => ({ ...b, canRecordOutcome: b.status === 'BOOKED' && slot.startAt <= at })),
  })).map(toSlotStaffView);
  const booked = slots.filter((s) => s.booking).length;
  const open = slots.filter((s) => !s.booking && s.status === 'OPEN').length;
  const closed = slots.filter((s) => !s.booking && s.status === 'CLOSED').length;
  return { date, slots, summary: { total: booked + open + closed, booked, open, closed } };
}

const SLOT_CHANGE_MESSAGES = {
  SLOT_NOT_EDITABLE: 'This slot can no longer be changed.',
  SLOT_HAS_BOOKING: 'This slot is booked. Cancel it with a reason instead.',
} as const;
const slotNotFound = () => new AppError(404, 'NOT_FOUND', 'Slot not found.');

/**
 * F-07 §1: locks the caller's slot (missing or another staff member's → 404), reads its BOOKED booking and applies
 * checkSlotChange; then runs `change` in the same transaction.
 */
function withOwnSlot<T>(staffId: number, slotId: number, action: SlotAction,
  change: (tx: Prisma.TransactionClient, slot: Prisma.SlotGetPayload<object>, booking: { id: number; reference: string } | null, at: Date) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Slot" WHERE id = ${slotId} AND "staffId" = ${staffId} FOR UPDATE`;
    if (!locked) throw slotNotFound();
    const at = now();
    const slot = await tx.slot.findUniqueOrThrow({ where: { id: slotId } });
    const booking = await tx.booking.findFirst({ where: { slotId, status: 'BOOKED' }, select: { id: true, reference: true } });
    const refusal = checkSlotChange(action, slot, !!booking, at);
    if (refusal) throw new AppError(409, refusal, SLOT_CHANGE_MESSAGES[refusal]);
    return change(tx, slot, booking, at);
  });
}
const viewOf = async (tx: Prisma.TransactionClient, id: number) =>
  toSlotStaffView(await tx.slot.findUniqueOrThrow({ where: { id }, include: SLOT_STAFF_INCLUDE }));

/** Edit time (F-07): same duration as now, BR-06 (service activity not re-checked) and BR-07 against the other own slots. */
export function editSlot(staffId: number, slotId: number, input: { date: string; startTime: string }) {
  return withOwnSlot(staffId, slotId, 'edit', async (tx, slot, _booking, at) => {
    const durationMin = (slot.endAt.getTime() - slot.startAt.getTime()) / 60_000;
    const range = validateSlot({ serviceId: slot.serviceId, ...input }, { durationMin, isActive: true }, at);
    if ('fields' in range) throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', range.fields);
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${staffId} FOR UPDATE`; // BR-07 lock of F-03
    const nearby = await tx.slot.findMany({ where: { staffId, id: { not: slotId }, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } } });
    if (findOverlap(range, nearby)) throw new AppError(409, 'SLOT_OVERLAP', 'You already have a slot at this time.');
    await tx.slot.update({ where: { id: slotId }, data: range });
    return viewOf(tx, slotId);
  });
}

/** Close an OPEN unbooked slot / reopen a CLOSED one (F-07). */
export function setSlotOpen(staffId: number, slotId: number, open: boolean) {
  return withOwnSlot(staffId, slotId, open ? 'reopen' : 'close', async (tx) => {
    await tx.slot.update({ where: { id: slotId }, data: { status: open ? 'OPEN' : 'CLOSED' } });
    return viewOf(tx, slotId);
  });
}

/** Cancel with reason (F-07, BR-14 cascade): the BOOKED booking is cancelled by the staff member, with its history row (F-10). */
export function cancelSlot(staffId: number, slotId: number, reason: string) {
  return withOwnSlot(staffId, slotId, 'cancel', async (tx, _slot, booking, at) => {
    if (booking) {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED', cancelledAt: at, cancelledById: staffId } });
      await recordStatusChange(tx, { bookingId: booking.id, from: 'BOOKED', to: 'CANCELLED', actorId: staffId, reason, at });
    }
    await tx.slot.update({ where: { id: slotId }, data: { status: 'CANCELLED' } });
    return { slot: await viewOf(tx, slotId), cancelledBooking: booking?.reference ?? null };
  });
}

