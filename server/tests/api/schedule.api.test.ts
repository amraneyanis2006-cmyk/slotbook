import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 8 Apr 2030 08:00 Bangkok; this file owns the slots of April 2030.
const NOW = '2030-04-08T08:00:00+07:00';
const DAY = '2030-04-09';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, mali: 0, ploy: 0, ken: 0, nina: 0, advising: 0 };
let anan: Agent;
let ploy: Agent;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  Object.assign(ids, {
    anan: await user('staff.anan@slotbook.test'), mali: await user('staff.mali@slotbook.test'),
    ploy: await user('cust.ploy@slotbook.test'), ken: await user('cust.ken@slotbook.test'), nina: await user('cust.nina@slotbook.test'),
    advising: (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id,
  });
  anan = request.agent(app);
  ploy = request.agent(app);
  await loginAs(anan, 'staff.anan@slotbook.test');
  await loginAs(ploy, 'cust.ploy@slotbook.test');
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2030-04-01', '00:00'), bkk('2030-05-01', '00:00'));
  await prisma.$disconnect();
});

const slot = (staff: 'anan' | 'mali', date: string, time: string, status: 'OPEN' | 'CLOSED' | 'CANCELLED' = 'OPEN') =>
  makeSlot(prisma, { staffId: ids[staff], serviceId: ids.advising, date, time, status });

describe('GET /api/staff/schedule (F-06)', () => {
  it('API-24: only the caller\'s non-cancelled slots of that Bangkok day, ordered, with reference, customer and note, and a summary where total = booked + open + closed; Customer 403; bad date 422', async () => {
    const open = await slot('anan', DAY, '08:00');
    const booked = await slot('anan', DAY, '09:00');
    const bookedRow = await makeBooking(prisma, { slotId: booked.id, customerId: ids.ploy, note: 'Transcript question' });
    const closed = await slot('anan', DAY, '10:00', 'CLOSED');
    await slot('anan', DAY, '11:00', 'CANCELLED');
    const freed = await slot('anan', DAY, '12:00'); // its only booking is CANCELLED: open, no booking shown
    await makeBooking(prisma, { slotId: freed.id, customerId: ids.ken, status: 'CANCELLED' });
    const completed = await slot('anan', DAY, '13:00', 'CLOSED'); // a finished booking counts as booked
    await makeBooking(prisma, { slotId: completed.id, customerId: ids.ken, status: 'COMPLETED' });
    const noShow = await slot('anan', DAY, '14:00');
    await makeBooking(prisma, { slotId: noShow.id, customerId: ids.nina, status: 'NO_SHOW' });
    const malis = await slot('mali', DAY, '09:00');
    await makeBooking(prisma, { slotId: malis.id, customerId: ids.ken });
    await slot('anan', '2030-04-10', '00:00'); // next Bangkok day
    await slot('anan', '2030-04-08', '23:45'); // previous Bangkok day

    const res = await anan.get('/api/staff/schedule').query({ date: DAY });
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(DAY);
    expect(res.body.slots.map((s: { id: number }) => s.id)).toEqual([open.id, booked.id, closed.id, freed.id, completed.id, noShow.id]);
    expect(res.body.summary).toEqual({ total: 6, booked: 3, open: 2, closed: 1 });
    expect(res.body.slots[1]).toEqual({
      id: booked.id, startAt: '2030-04-09T02:00:00.000Z', endAt: '2030-04-09T02:30:00.000Z', status: 'OPEN',
      service: { id: ids.advising, name: 'Academic advising', durationMin: 30 },
      booking: { reference: bookedRow.reference, status: 'BOOKED', note: 'Transcript question', customer: { id: ids.ploy, name: 'Ploy Chai' } },
    });
    expect(res.body.slots[0].booking).toBeNull();
    expect(res.body.slots[3].booking).toBeNull();
    expect(res.body.slots[4].booking).toMatchObject({ status: 'COMPLETED', customer: { name: 'Ken Tan' } });
    expect(res.body.slots[5].booking).toMatchObject({ status: 'NO_SHOW', customer: { name: 'Nina Park' } });

    const forbidden = await ploy.get('/api/staff/schedule').query({ date: DAY });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe('FORBIDDEN');
    for (const query of [{ date: '2030-04-31' }, {}, { date: '09/04/2030' }]) {
      const bad = await anan.get('/api/staff/schedule').query(query);
      expect(bad.status, JSON.stringify(query)).toBe(422);
      expect(bad.body.error).toBe('VALIDATION_ERROR');
      expect(bad.body.fields).toHaveProperty('date');
    }
  });
});
