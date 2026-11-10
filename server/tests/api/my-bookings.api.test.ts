import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 4 Mar 2030 08:00 Bangkok; this file owns the slots of March 2030.
const NOW = '2030-03-04T08:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, mali: 0, ploy: 0, ken: 0, advising: 0 };
const agents = {} as Record<'ploy' | 'ken' | 'nina', Agent>;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  Object.assign(ids, {
    anan: await user('staff.anan@slotbook.test'), mali: await user('staff.mali@slotbook.test'),
    ploy: await user('cust.ploy@slotbook.test'), ken: await user('cust.ken@slotbook.test'),
    advising: (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id,
  });
  for (const name of ['ploy', 'ken', 'nina'] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], `cust.${name}@slotbook.test`);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2030-03-01', '00:00'), bkk('2030-04-01', '00:00'));
  await prisma.$disconnect();
});

/** A booking of `customer` on a new Anan (or Mali) slot at a Bangkok date/time. */
async function bookingAt(customer: 'ploy' | 'ken', date: string, time: string, status: 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' = 'BOOKED', staff: 'anan' | 'mali' = 'anan') {
  const slot = await makeSlot(prisma, { staffId: ids[staff], serviceId: ids.advising, date, time });
  return { slot, booking: await makeBooking(prisma, { slotId: slot.id, customerId: ids[customer], status, note: `${customer} ${date} ${time}` }) };
}
const cancel = (agent: Agent, reference: string) => agent.post(`/api/bookings/${reference}/cancel`).send({});
type View = { reference: string; status: string; slot: { startAt: string } };

describe('GET /api/bookings/mine, GET /api/bookings/:reference (F-05)', () => {
  it('API-20: only the caller\'s bookings, split into upcoming (BOOKED, start ≥ now, ascending) and past (newest first); detail by reference; same data after a new login', async () => {
    const later = await bookingAt('ploy', '2030-03-06', '10:00');
    const sooner = await bookingAt('ploy', '2030-03-05', '09:00');
    const completed = await bookingAt('ploy', '2030-03-01', '09:00', 'COMPLETED');
    const cancelledFuture = await bookingAt('ploy', '2030-03-07', '09:00', 'CANCELLED');
    const bookedPast = await bookingAt('ploy', '2030-03-02', '09:00');
    const kens = await bookingAt('ken', '2030-03-06', '11:00');

    const res = await agents.ploy.get('/api/bookings/mine');
    expect(res.status).toBe(200);
    const { upcoming, past } = res.body as { upcoming: View[]; past: View[] };
    expect(upcoming.map((b) => b.reference)).toEqual([sooner.booking.reference, later.booking.reference]);
    expect(past.map((b) => b.reference)).toEqual(expect.arrayContaining([cancelledFuture.booking.reference, bookedPast.booking.reference, completed.booking.reference]));
    const pastStarts = past.map((b) => b.slot.startAt);
    expect(pastStarts).toEqual([...pastStarts].sort().reverse());
    expect([...upcoming, ...past].map((b) => b.reference)).not.toContain(kens.booking.reference);
    const owners = await prisma.booking.findMany({ where: { reference: { in: [...upcoming, ...past].map((b) => b.reference) } }, select: { customerId: true } });
    expect(new Set(owners.map((o) => o.customerId))).toEqual(new Set([ids.ploy]));

    expect(upcoming[0]).toEqual({
      reference: sooner.booking.reference, status: 'BOOKED', note: 'ploy 2030-03-05 09:00',
      createdAt: expect.any(String), cancelledAt: null,
      slot: {
        id: sooner.slot.id, startAt: '2030-03-05T02:00:00.000Z', endAt: '2030-03-05T02:30:00.000Z',
        service: { id: ids.advising, name: 'Academic advising', durationMin: 30 }, staff: { id: ids.anan, name: 'Anan Wong' },
      },
    });
    const detail = await agents.ploy.get(`/api/bookings/${sooner.booking.reference}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual({ booking: upcoming[0] });
    // A lower-case reference in the URL is normalised to upper case (F-05 §7).
    expect((await agents.ploy.get(`/api/bookings/${sooner.booking.reference.toLowerCase()}`)).body).toEqual({ booking: upcoming[0] });

    const first = request.agent(app);
    await loginAs(first, 'cust.ploy@slotbook.test');
    expect((await first.post('/api/auth/logout')).status).toBe(204);
    const relogged = request.agent(app);
    await loginAs(relogged, 'cust.ploy@slotbook.test');
    expect((await relogged.get('/api/bookings/mine')).body).toEqual(res.body);
    expect((await relogged.get(`/api/bookings/${sooner.booking.reference}`)).body).toEqual({ booking: upcoming[0] });
  });

  it('API-21: reading or cancelling Ken\'s booking as Ploy → 404 NOT_FOUND without booking data; Ken\'s booking still BOOKED', async () => {
    const { booking } = await bookingAt('ken', '2030-03-12', '10:00');
    const notFound = { error: 'NOT_FOUND', message: 'Booking not found.' };

    const read = await agents.ploy.get(`/api/bookings/${booking.reference}`);
    expect(read.status).toBe(404);
    expect(read.body).toEqual(notFound);
    const cancelled = await cancel(agents.ploy, booking.reference);
    expect(cancelled.status).toBe(404);
    expect(cancelled.body).toEqual(notFound);
    // An unknown reference gets exactly the same answer (no existence leak, BR-09).
    for (const unknown of [await agents.ploy.get('/api/bookings/BK-2030-999999'), await cancel(agents.ploy, 'BK-2030-999999')]) {
      expect(unknown.status).toBe(404);
      expect(unknown.body).toEqual(notFound);
    }

    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'BOOKED', cancelledAt: null, cancelledById: null });
  });
});

describe('POST /api/bookings/:reference/cancel (F-05)', () => {
  it('API-22: cancelling at +3 h (and exactly +120 min) → 200 CANCELLED with cancelledAt; the slot is available again and Nina books it', async () => {
    const { slot, booking } = await bookingAt('ploy', '2030-03-04', '11:00');

    const res = await cancel(agents.ploy, booking.reference);
    expect(res.status).toBe(200);
    expect(res.body.booking).toMatchObject({ reference: booking.reference, status: 'CANCELLED', cancelledAt: '2030-03-04T01:00:00.000Z' });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'CANCELLED', cancelledById: ids.ploy });

    const available = await agents.nina.get('/api/slots/available').query({ date: '2030-03-04' });
    expect(available.body.slots.map((s: { id: number }) => s.id)).toContain(slot.id);
    expect((await agents.nina.post('/api/bookings').send({ slotId: slot.id })).status).toBe(201);

    const boundary = await bookingAt('ploy', '2030-03-04', '10:00', 'BOOKED', 'mali'); // exactly 120 min before the start
    expect((await cancel(agents.ploy, boundary.booking.reference.toLowerCase())).status).toBe(200); // lower-case URL too
  });

  it('API-23: inside 2 h → 409 CANCELLATION_WINDOW_CLOSED; CANCELLED/COMPLETED/NO_SHOW (or a second cancel) → 409 BOOKING_NOT_ACTIVE; rows unchanged', async () => {
    const inside = [await bookingAt('ploy', '2030-03-04', '09:30'), await bookingAt('ploy', '2030-03-04', '09:59', 'BOOKED', 'mali')]; // +90, +119 min
    const inactive = [
      await bookingAt('ploy', '2030-03-14', '09:00', 'CANCELLED'),
      await bookingAt('ploy', '2030-03-01', '10:00', 'COMPLETED'),
      await bookingAt('ploy', '2030-03-02', '10:00', 'NO_SHOW'),
      await bookingAt('ploy', '2030-03-04', '09:00', 'CANCELLED', 'mali'), // inside 2 h too: BR-13 is checked first
    ];
    const before = await prisma.booking.findMany({ where: { id: { in: [...inside, ...inactive].map((b) => b.booking.id) } }, orderBy: { id: 'asc' } });

    for (const { booking } of inside) {
      const res = await cancel(agents.ploy, booking.reference);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'CANCELLATION_WINDOW_CLOSED', message: 'Cancellation closes 2 hours before the start.' });
    }
    for (const { booking } of inactive) {
      const res = await cancel(agents.ploy, booking.reference);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'BOOKING_NOT_ACTIVE', message: 'This booking is no longer active.' });
    }
    expect(await prisma.booking.findMany({ where: { id: { in: before.map((b) => b.id) } }, orderBy: { id: 'asc' } })).toEqual(before);

    const twice = await bookingAt('ploy', '2030-03-20', '09:00');
    expect((await cancel(agents.ploy, twice.booking.reference)).status).toBe(200);
    const second = await cancel(agents.ploy, twice.booking.reference);
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: 'BOOKING_NOT_ACTIVE', message: 'This booking is no longer active.' });
  });
});
