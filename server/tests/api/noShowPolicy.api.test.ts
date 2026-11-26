import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Thu 20 Feb 2031 08:00 Bangkok; this file owns the slots of February 2031 and the account it creates.
const NOW = '2031-02-20T08:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, advising: 0, customer: 0 };
let customer: Agent;
const EMAIL = 'cust.noshow@slotbook.test';

beforeAll(async () => {
  const ploy = await prisma.user.findUniqueOrThrow({ where: { email: 'cust.ploy@slotbook.test' } });
  ids.anan = (await prisma.user.findUniqueOrThrow({ where: { email: 'staff.anan@slotbook.test' } })).id;
  ids.advising = (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id;
  ids.customer = (await prisma.user.create({ data: { email: EMAIL, name: 'No Show', role: 'CUSTOMER', passwordHash: ploy.passwordHash } })).id;
  customer = request.agent(app);
  await loginAs(customer, EMAIL);
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2031-02-01', '00:00'), bkk('2031-03-01', '00:00'));
  await prisma.user.delete({ where: { id: ids.customer } });
  await prisma.$disconnect();
});

const slot = (date: string, time: string, status: 'OPEN' | 'CLOSED' = 'OPEN') =>
  makeSlot(prisma, { staffId: ids.anan, serviceId: ids.advising, date, time, status });
/** A NO_SHOW booking whose outcome was recorded at `recordedAt` (history row as F-09 writes it). */
async function noShow(date: string, recordedAt: Date) {
  const b = await makeBooking(prisma, { slotId: (await slot(date, '09:00')).id, customerId: ids.customer, status: 'NO_SHOW' });
  await prisma.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'BOOKED', toStatus: 'NO_SHOW', actorId: ids.anan, createdAt: recordedAt } });
}

describe('no-show policy (F-17 §1 step 3, BR-19)', () => {
  it('API-55: 3 no-shows recorded in 30 days → 409 BOOKING_SUSPENDED on book and reschedule until third + 7 days; BR-02/BR-01 still first; allowed afterwards', async () => {
    const target = await slot('2031-02-25', '10:00');
    await noShow('2031-02-03', bkk('2031-02-03', '10:00'));
    await noShow('2031-02-10', bkk('2031-02-10', '10:00'));
    expect((await customer.post('/api/bookings').send({ slotId: (await slot('2031-02-26', '10:00')).id })).status).toBe(201); // 2 no-shows: allowed
    const existing = await prisma.booking.findFirstOrThrow({ where: { customerId: ids.customer, status: 'BOOKED' } });
    await noShow('2031-02-15', bkk('2031-02-15', '10:00'));

    const refused = await customer.post('/api/bookings').send({ slotId: target.id });
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ error: 'BOOKING_SUSPENDED', message: 'Your booking access is suspended until Sat 22 Feb 2031, 10:00 after 3 missed appointments.' });
    const moved = await customer.post(`/api/bookings/${existing.reference}/reschedule`).send({ slotId: target.id });
    expect(moved.body.error).toBe('BOOKING_SUSPENDED');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: existing.id } })).status).toBe('BOOKED'); // nothing changed
    const closed = await slot('2031-02-25', '11:00', 'CLOSED');
    expect((await customer.post('/api/bookings').send({ slotId: closed.id })).body.error).toBe('SLOT_NOT_BOOKABLE'); // BR-02 before BR-19

    freezeClock('2031-02-22T10:00:00+07:00'); // exactly 7 days after the third: over
    expect((await customer.post('/api/bookings').send({ slotId: target.id })).status).toBe(201);
  });
});
