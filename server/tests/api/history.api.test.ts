import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 3 Jun 2030 08:00 Bangkok; this file owns the slots of June 2030.
const NOW = '2030-06-03T08:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, mali: 0, ploy: 0, ken: 0, advising: 0 };
const agents = {} as Record<'ploy' | 'ken' | 'anan' | 'mali', Agent>;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  Object.assign(ids, {
    anan: await user('staff.anan@slotbook.test'), mali: await user('staff.mali@slotbook.test'),
    ploy: await user('cust.ploy@slotbook.test'), ken: await user('cust.ken@slotbook.test'),
    advising: (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id,
  });
  for (const [name, email] of [['ploy', 'cust.ploy'], ['ken', 'cust.ken'], ['anan', 'staff.anan'], ['mali', 'staff.mali']] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], `${email}@slotbook.test`);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2030-06-01', '00:00'), bkk('2030-07-01', '00:00'));
  await prisma.$disconnect();
});

const anansSlot = (date: string, time: string, status: 'OPEN' | 'CLOSED' = 'OPEN') =>
  makeSlot(prisma, { staffId: ids.anan, serviceId: ids.advising, date, time, status });
const historyOf = (reference: string) =>
  prisma.bookingStatusChange.findMany({ where: { booking: { reference } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

describe('history writers (F-10 §1)', () => {
  it('API-29: booking appends null→BOOKED and cancelling appends BOOKED→CANCELLED, by the customer, at the time of the change; a refused booking leaves no row', async () => {
    const slot = await anansSlot('2030-06-10', '09:00');
    const booked = await agents.ploy.post('/api/bookings').send({ slotId: slot.id, note: 'History check' });
    expect(booked.status).toBe(201);
    const ref = booked.body.booking.reference as string;
    let rows = await historyOf(ref);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fromStatus: null, toStatus: 'BOOKED', actorId: ids.ploy, reason: null });
    expect(rows[0].createdAt.toISOString()).toBe(booked.body.booking.createdAt);

    freezeClock('2030-06-04T10:00:00+07:00');
    const cancelled = await agents.ploy.post(`/api/bookings/${ref}/cancel`).send({});
    expect(cancelled.status).toBe(200);
    rows = await historyOf(ref);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ fromStatus: 'BOOKED', toStatus: 'CANCELLED', actorId: ids.ploy, reason: null });
    expect(rows[1].createdAt.toISOString()).toBe(cancelled.body.booking.cancelledAt);

    const before = await prisma.bookingStatusChange.count();
    const closed = await anansSlot('2030-06-10', '10:00', 'CLOSED');
    const refused = await agents.ploy.post('/api/bookings').send({ slotId: closed.id });
    expect(refused.status).toBe(409);
    const tooLate = await agents.ploy.post(`/api/bookings/${ref}/cancel`).send({});
    expect(tooLate.body.error).toBe('BOOKING_NOT_ACTIVE');
    expect(await prisma.bookingStatusChange.count()).toBe(before);
  });
});

describe('GET history (F-10 §3)', () => {
  it('API-30: the customer and the slot\'s staff member read the history oldest first; other customer / other staff → 404 without data; wrong role → 403', async () => {
    const slot = await anansSlot('2030-06-11', '09:00');
    const booked = await agents.ploy.post('/api/bookings').send({ slotId: slot.id });
    const ref = booked.body.booking.reference as string;
    freezeClock('2030-06-04T09:00:00+07:00');
    await agents.ploy.post(`/api/bookings/${ref}/cancel`).send({});

    const own = await agents.ploy.get(`/api/bookings/${ref.toLowerCase()}`);
    expect(own.status).toBe(200);
    expect(own.body.booking.reference).toBe(ref);
    expect(own.body.history).toEqual([
      { at: booked.body.booking.createdAt, from: null, to: 'BOOKED', actor: { name: 'Ploy Chai', role: 'CUSTOMER' }, reason: null },
      { at: '2030-06-04T02:00:00.000Z', from: 'BOOKED', to: 'CANCELLED', actor: { name: 'Ploy Chai', role: 'CUSTOMER' }, reason: null },
    ]);

    const staff = await agents.anan.get(`/api/staff/bookings/${ref}`);
    expect(staff.status).toBe(200);
    expect(staff.body.booking).toMatchObject({ reference: ref, status: 'CANCELLED', customer: { id: ids.ploy, name: 'Ploy Chai' } });
    expect(staff.body.history).toEqual(own.body.history);

    for (const res of [await agents.ken.get(`/api/bookings/${ref}`), await agents.mali.get(`/api/staff/bookings/${ref}`)]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'NOT_FOUND', message: 'Booking not found.' });
    }
    expect((await agents.anan.get(`/api/bookings/${ref}`)).status).toBe(403);
    expect((await agents.ploy.get(`/api/staff/bookings/${ref}`)).status).toBe(403);
    expect((await request(app).get(`/api/staff/bookings/${ref}`)).status).toBe(401);
  });
});
