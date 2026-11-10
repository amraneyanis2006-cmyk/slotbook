import type { BookingStatus, PrismaClient, SlotStatus } from '@prisma/client';
import type { Agent } from 'supertest';
import { formatReference } from '../src/rules/bookingRules.js';
import { setNow } from '../src/utils/clock.js';

/** Logs the agent in as a seeded account (password from SEED_PASSWORD); returns the response. */
export const loginAs = (agent: Agent, email: string) =>
  agent.post('/api/auth/login').send({ email, password: process.env.SEED_PASSWORD });

/** Freezes server time for rule checks; call unfreezeClock() in afterEach. */
export const freezeClock = (iso: string) => setNow(new Date(iso));
export const unfreezeClock = () => setNow(null);

/** UTC instant of a Bangkok local date + HH:mm. */
export const bkk = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);

/** Inserts a slot straight into the test DB (no rule check), for test preconditions. */
export const makeSlot = (prisma: PrismaClient, { staffId, serviceId, date, time, durationMin = 30, status = 'OPEN' }:
  { staffId: number; serviceId: number; date: string; time: string; durationMin?: number; status?: SlotStatus }) =>
  prisma.slot.create({
    data: { staffId, serviceId, status, startAt: bkk(date, time), endAt: new Date(bkk(date, time).getTime() + durationMin * 60_000) },
  });

/** Inserts a booking straight into the test DB with a reference from booking_ref_seq. */
export async function makeBooking(prisma: PrismaClient, { slotId, customerId, status = 'BOOKED', note = null }:
  { slotId: number; customerId: number; status?: BookingStatus; note?: string | null }) {
  const [{ seq }] = await prisma.$queryRaw<{ seq: bigint }[]>`SELECT nextval('booking_ref_seq') AS seq`;
  return prisma.booking.create({
    data: {
      slotId, customerId, status, note, reference: formatReference(2030, Number(seq)),
      ...(status === 'CANCELLED' && { cancelledAt: new Date(), cancelledById: customerId }),
    },
  });
}

/** Deletes the bookings and slots a test file created in [from, to), so files sharing the test DB stay independent. */
export async function removeSlotsBetween(prisma: PrismaClient, from: Date, to: Date) {
  const where = { startAt: { gte: from, lt: to } };
  await prisma.booking.deleteMany({ where: { slot: where } });
  await prisma.slot.deleteMany({ where });
}
