import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 5 May 2031 08:00 Bangkok; this file owns the slots of May 2031.
const NOW = '2031-05-05T08:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, ploy: 0, ken: 0, advising: 0, leaving: 0 };
const agents = {} as Record<'anan' | 'ploy' | 'ken', Agent>;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  Object.assign(ids, { anan: await user('staff.anan@slotbook.test'), ploy: await user('cust.ploy@slotbook.test'), ken: await user('cust.ken@slotbook.test') });
  ids.advising = (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id;
  const hash = (await prisma.user.findUniqueOrThrow({ where: { id: ids.ploy } })).passwordHash;
  ids.leaving = (await prisma.user.create({ data: { email: 'cust.notified@slotbook.test', name: 'Nora Notified', role: 'CUSTOMER', passwordHash: hash } })).id;
  for (const [name, email] of [['anan', 'staff.anan'], ['ploy', 'cust.ploy'], ['ken', 'cust.ken']] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], `${email}@slotbook.test`);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2031-05-01', '00:00'), bkk('2031-06-01', '00:00'));
  await prisma.user.delete({ where: { id: ids.leaving } });
  await prisma.$disconnect();
});

const slot = (date: string, time: string) => makeSlot(prisma, { staffId: ids.anan, serviceId: ids.advising, date, time });
const book = async (agent: Agent, date: string, time: string) => (await agent.post('/api/bookings').send({ slotId: (await slot(date, time)).id })).body.booking.reference as string;
const count = (userId: number) => prisma.notification.count({ where: { userId } });

describe('notifications (F-16)', () => {
  it('API-53: staff cancellation, outcome and deactivation notify the customer in the same transaction; the customer\'s own cancel and reschedule do not', async () => {
    const before = await count(ids.ploy);
    const own = await book(agents.ploy, '2031-05-08', '09:00');
    await agents.ploy.post(`/api/bookings/${own}/cancel`).send({});
    const moved = await book(agents.ploy, '2031-05-08', '10:00');
    const target = await slot('2031-05-08', '11:00');
    const res = await agents.ploy.post(`/api/bookings/${moved}/reschedule`).send({ slotId: target.id });
    expect(res.status).toBe(201);
    expect(await count(ids.ploy)).toBe(before); // customer actions: none

    const staffSlot = await prisma.booking.findUniqueOrThrow({ where: { reference: res.body.booking.reference }, include: { slot: true } });
    await agents.anan.post(`/api/staff/slots/${staffSlot.slotId}/cancel`).send({ reason: 'Staff illness' });
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: ids.ploy }, orderBy: { id: 'desc' } });
    expect(n).toMatchObject({ bookingId: staffSlot.id, readAt: null,
      message: `Your booking ${res.body.booking.reference} on Thu 8 May 2031, 11:00 was cancelled by Anan Wong: Staff illness.` });
    const change = await prisma.bookingStatusChange.findFirstOrThrow({ where: { bookingId: staffSlot.id, toStatus: 'CANCELLED' } });
    expect(n.createdAt).toEqual(change.createdAt);

    const past = await book(agents.ploy, '2031-05-05', '09:00');
    freezeClock('2031-05-05T09:30:00+07:00');
    await agents.anan.post(`/api/staff/bookings/${past}/outcome`).send({ outcome: 'NO_SHOW' });
    expect((await prisma.notification.findFirstOrThrow({ where: { userId: ids.ploy }, orderBy: { id: 'desc' } })).message)
      .toBe(`Your booking ${past} on Mon 5 May 2031, 09:00 was recorded as No-show.`);
    expect(await count(ids.ploy)).toBe(before + 2);

    const kept = await makeBooking(prisma, { slotId: (await slot('2031-05-20', '09:00')).id, customerId: ids.leaving, status: 'BOOKED' });
    await agents.anan.post(`/api/staff/users/${ids.leaving}/deactivate`).send({});
    const notes = await prisma.notification.findMany({ where: { userId: ids.leaving } });
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toBe(`Your booking ${kept.reference} on Tue 20 May 2031, 09:00 was cancelled by Anan Wong: account deactivated.`);
  });

  it('API-54: own notifications newest first with the unread count; read one / read all; another customer\'s id → 404; Staff → 403', async () => {
    const ref = await book(agents.ken, '2031-05-12', '09:00');
    const b = await prisma.booking.findUniqueOrThrow({ where: { reference: ref } });
    await agents.anan.post(`/api/staff/slots/${b.slotId}/cancel`).send({ reason: 'Office closed' });
    const ref2 = await book(agents.ken, '2031-05-12', '10:00');
    const b2 = await prisma.booking.findUniqueOrThrow({ where: { reference: ref2 } });
    freezeClock('2031-05-05T08:05:00+07:00');
    await agents.anan.post(`/api/staff/slots/${b2.slotId}/cancel`).send({ reason: 'Training day' });

    const list = await agents.ken.get('/api/notifications');
    expect(list.status).toBe(200);
    expect(list.body.unread).toBeGreaterThanOrEqual(2);
    expect(list.body.notifications[0]).toEqual({ id: expect.any(Number), message: expect.stringContaining('Training day'), bookingReference: ref2, createdAt: '2031-05-05T01:05:00.000Z', readAt: null });
    expect(list.body.notifications[1].message).toContain('Office closed');
    expect(list.body.notifications.every((x: { message: string }) => !x.message.includes('Ploy'))).toBe(true);

    const first = list.body.notifications[0].id as number;
    const read = await agents.ken.post(`/api/notifications/${first}/read`).send({});
    expect(read.body.notification.readAt).toBe('2031-05-05T01:05:00.000Z');
    expect((await agents.ken.get('/api/notifications')).body.unread).toBe(list.body.unread - 1);
    expect((await agents.ploy.post(`/api/notifications/${first}/read`).send({})).status).toBe(404);
    expect((await agents.ken.post('/api/notifications/read-all').send({})).body).toEqual({ unread: 0 });
    expect((await agents.anan.get('/api/notifications')).status).toBe(403);
    expect((await request(app).get('/api/notifications')).status).toBe(401);
  });
});
