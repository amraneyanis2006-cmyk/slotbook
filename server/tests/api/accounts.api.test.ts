import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 10 Mar 2031 10:00 Bangkok; this file owns the slots of March 2031 and the accounts it creates.
const NOW = '2031-03-10T10:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, advising: 0, gone: 0, other: 0 };
const agents = {} as Record<'anan' | 'ploy' | 'gone', Agent>;

beforeAll(async () => {
  const ploy = await prisma.user.findUniqueOrThrow({ where: { email: 'cust.ploy@slotbook.test' } });
  ids.anan = (await prisma.user.findUniqueOrThrow({ where: { email: 'staff.anan@slotbook.test' } })).id;
  ids.advising = (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id;
  ids.gone = (await prisma.user.create({ data: { email: 'cust.leaving@slotbook.test', name: 'Aaron Leaving', role: 'CUSTOMER', passwordHash: ploy.passwordHash } })).id;
  for (const [name, email] of [['anan', 'staff.anan@slotbook.test'], ['ploy', 'cust.ploy@slotbook.test'], ['gone', 'cust.leaving@slotbook.test']] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], email);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2031-03-01', '00:00'), bkk('2031-04-01', '00:00'));
  await prisma.user.delete({ where: { id: ids.gone } });
  await prisma.$disconnect();
});

const booking = async (date: string, time: string, status: 'BOOKED' | 'COMPLETED' = 'BOOKED') =>
  makeBooking(prisma, { slotId: (await makeSlot(prisma, { staffId: ids.anan, serviceId: ids.advising, date, time })).id, customerId: ids.gone, status });

describe('accounts (F-17)', () => {
  it('API-56: deactivating cancels future BOOKED bookings with "account deactivated" and history, ends the session; reactivating restores login only', async () => {
    const f1 = await booking('2031-03-12', '09:00');
    const f2 = await booking('2031-03-20', '09:00');
    const started = await booking('2031-03-10', '09:50'); // started 10 minutes ago: not cancelled
    const past = await booking('2031-03-03', '09:00', 'COMPLETED');
    expect((await agents.gone.get('/api/bookings/mine')).status).toBe(200);

    const res = await agents.anan.post(`/api/staff/users/${ids.gone}/deactivate`).send({});
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: ids.gone, isActive: false });
    expect([...res.body.cancelledBookings].sort()).toEqual([f1.reference, f2.reference].sort());
    for (const b of [f1, f2]) {
      expect(await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ status: 'CANCELLED', cancelledById: ids.anan });
      expect(await prisma.bookingStatusChange.findFirst({ where: { bookingId: b.id } }))
        .toMatchObject({ fromStatus: 'BOOKED', toStatus: 'CANCELLED', actorId: ids.anan, reason: 'account deactivated' });
    }
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: started.id } })).status).toBe('BOOKED');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: past.id } })).status).toBe('COMPLETED');
    expect((await agents.gone.get('/api/bookings/mine')).status).toBe(401); // BR-12: the session is gone
    const again = await agents.anan.post(`/api/staff/users/${ids.gone}/deactivate`).send({});
    expect(again.body.cancelledBookings).toEqual([]);

    const back = await agents.anan.post(`/api/staff/users/${ids.gone}/reactivate`).send({});
    expect(back.body.user.isActive).toBe(true);
    expect((await loginAs(agents.gone, 'cust.leaving@slotbook.test')).status).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f1.id } })).status).toBe('CANCELLED');
  });

  it('API-57: customers only, by name, with computed columns and a name filter; Customer → 403; a staff or unknown id → 404', async () => {
    await booking('2031-03-25', '09:00');
    const res = await agents.anan.get('/api/staff/users');
    expect(res.status).toBe(200);
    const users = res.body.users as { name: string; email: string }[];
    expect(users.every((u) => !u.email.startsWith('staff.'))).toBe(true);
    expect(users.map((u) => u.name)).toEqual([...users.map((u) => u.name)].sort((a, b) => a.localeCompare(b)));
    const aaron = users.find((u) => u.name === 'Aaron Leaving');
    expect(aaron).toEqual({ id: ids.gone, name: 'Aaron Leaving', email: 'cust.leaving@slotbook.test', isActive: true, suspendedUntil: null,
      activeBookings: 1, activeBookingRefs: [expect.stringMatching(/^BK-/)], noShows30d: 0 });
    const filtered = await agents.anan.get('/api/staff/users').query({ q: 'leav' });
    expect(filtered.body.users.map((u: { id: number }) => u.id)).toEqual([ids.gone]);

    expect((await agents.ploy.get('/api/staff/users')).status).toBe(403);
    expect((await request(app).get('/api/staff/users')).status).toBe(401);
    for (const id of [ids.anan, 999_999, 'abc']) {
      const r = await agents.anan.post(`/api/staff/users/${id}/deactivate`).send({});
      expect([r.status, r.body.error]).toEqual([404, 'NOT_FOUND']);
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.anan } })).isActive).toBe(true);
  });
});
