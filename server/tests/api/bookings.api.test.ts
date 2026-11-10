import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Tue 5 Feb 2030 08:00 Bangkok; this file owns the slots of 1–28 Feb 2030.
const NOW = '2030-02-05T08:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, mali: 0, ploy: 0, ken: 0, nina: 0, advising: 0, document: 0, thesis: 0 };
const agents = {} as Record<'ploy' | 'ken' | 'nina' | 'anan', Agent>;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  const service = (name: string) => prisma.service.findUniqueOrThrow({ where: { name } }).then((s) => s.id);
  Object.assign(ids, {
    anan: await user('staff.anan@slotbook.test'), mali: await user('staff.mali@slotbook.test'),
    ploy: await user('cust.ploy@slotbook.test'), ken: await user('cust.ken@slotbook.test'), nina: await user('cust.nina@slotbook.test'),
    advising: await service('Academic advising'), document: await service('Document request'), thesis: await service('Thesis consultation'),
  });
  for (const [name, email] of [['ploy', 'cust.ploy'], ['ken', 'cust.ken'], ['nina', 'cust.nina'], ['anan', 'staff.anan']] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], `${email}@slotbook.test`);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2030-02-01', '00:00'), bkk('2030-03-01', '00:00'));
  await prisma.$disconnect();
});

const slot = (staff: 'anan' | 'mali', date: string, time: string, extra: { status?: 'OPEN' | 'CLOSED' | 'CANCELLED'; service?: 'advising' | 'document' | 'thesis' } = {}) => {
  const service = extra.service ?? 'advising';
  return makeSlot(prisma, {
    staffId: ids[staff], serviceId: ids[service], date, time, status: extra.status,
    durationMin: { advising: 30, document: 15, thesis: 60 }[service],
  });
};
const book = (agent: Agent, slotId: number, body: Record<string, unknown> = {}) => agent.post('/api/bookings').send({ slotId, ...body });
const available = (agent: Agent, query: Record<string, string | number>) => agent.get('/api/slots/available').query(query);
const bookedCount = (slotId: number) => prisma.booking.count({ where: { slotId, status: 'BOOKED' } });

describe('GET /api/slots/available (F-04)', () => {
  it('API-14: only OPEN slots of that Bangkok day starting ≥ 60 min from now, unbooked, active service, ordered, filtered; no customer data; Staff 403; bad query 422', async () => {
    const free = await slot('anan', '2030-02-05', '09:00'); // exactly now + 60 min
    const freeDoc = await slot('mali', '2030-02-05', '09:00', { service: 'document' });
    const later = await slot('mali', '2030-02-05', '16:00');
    const booked = await slot('anan', '2030-02-05', '10:00');
    await makeBooking(prisma, { slotId: booked.id, customerId: ids.ken });
    await slot('mali', '2030-02-05', '11:00', { status: 'CLOSED' });
    await slot('mali', '2030-02-05', '12:00', { status: 'CANCELLED' });
    await slot('anan', '2030-02-05', '08:30'); // now + 30 min
    await slot('anan', '2030-02-05', '13:00', { service: 'thesis' }); // inactive service
    await slot('anan', '2030-02-06', '00:00'); // next Bangkok day
    await slot('anan', '2030-02-04', '23:45'); // previous Bangkok day

    const res = await available(agents.ploy, { date: '2030-02-05' });
    expect(res.status).toBe(200);
    expect(res.body.slots.map((s: { id: number }) => s.id)).toEqual([free.id, freeDoc.id, later.id]);
    expect(res.body.slots[0]).toEqual({
      id: free.id, startAt: '2030-02-05T02:00:00.000Z', endAt: '2030-02-05T02:30:00.000Z',
      service: { id: ids.advising, name: 'Academic advising', durationMin: 30 },
      staff: { id: ids.anan, name: 'Anan Wong' },
    });
    expect(res.text).not.toMatch(/customer|Ken Tan|email|reference/i);

    const filtered = await available(agents.ploy, { date: '2030-02-05', serviceId: ids.document });
    expect(filtered.body.slots.map((s: { id: number }) => s.id)).toEqual([freeDoc.id]);

    expect((await available(agents.anan, { date: '2030-02-05' })).status).toBe(403);
    for (const [query, field] of [[{ date: '2030-02-30' }, 'date'], [{}, 'date'], [{ date: '05/02/2030' }, 'date'], [{ date: '2030-02-05', serviceId: 'abc' }, 'serviceId'], [{ date: '2030-02-05', serviceId: 0 }, 'serviceId']] as const) {
      const bad = await available(agents.ploy, query);
      expect(bad.status, JSON.stringify(query)).toBe(422);
      expect(bad.body.error).toBe('VALIDATION_ERROR');
      expect(bad.body.fields).toHaveProperty(field);
    }
  });
});

describe('POST /api/bookings (F-04)', () => {
  it('API-15: Ploy books a bookable slot → 201 BOOKED with a BK-YYYY-NNNNNN reference, owned by Ploy, gone from the available list', async () => {
    const target = await slot('anan', '2030-02-06', '10:00');
    expect((await available(agents.ploy, { date: '2030-02-06' })).body.slots.map((s: { id: number }) => s.id)).toContain(target.id);

    const res = await book(agents.ploy, target.id, { note: 'Question about credit transfer' });
    expect(res.status).toBe(201);
    expect(res.body.booking).toEqual({
      reference: expect.stringMatching(/^BK-2030-\d{6}$/), // Bangkok year of creation (BR-10)
      status: 'BOOKED', note: 'Question about credit transfer',
      createdAt: expect.any(String), cancelledAt: null,
      slot: {
        id: target.id, startAt: '2030-02-06T03:00:00.000Z', endAt: '2030-02-06T03:30:00.000Z',
        service: { id: ids.advising, name: 'Academic advising', durationMin: 30 }, staff: { id: ids.anan, name: 'Anan Wong' },
      },
    });
    const row = await prisma.booking.findUniqueOrThrow({ where: { reference: res.body.booking.reference } });
    expect(row).toMatchObject({ slotId: target.id, customerId: ids.ploy, status: 'BOOKED' });
    expect((await available(agents.ploy, { date: '2030-02-06' })).body.slots.map((s: { id: number }) => s.id)).not.toContain(target.id);
  });

  it('API-15: a note of exactly 300 characters is accepted; 301 characters or a bad slotId → 422 with the field, nothing stored', async () => {
    const target = await slot('mali', '2030-02-06', '13:00');
    for (const [body, field] of [[{ slotId: target.id, note: 'x'.repeat(301) }, 'note'], [{ slotId: 'abc' }, 'slotId'], [{ slotId: -1 }, 'slotId'], [{}, 'slotId']] as const) {
      const bad = await agents.ken.post('/api/bookings').send(body);
      expect(bad.status, JSON.stringify(body).slice(0, 40)).toBe(422);
      expect(bad.body.error).toBe('VALIDATION_ERROR');
      expect(bad.body.fields).toHaveProperty(field);
    }
    expect(await bookedCount(target.id)).toBe(0);

    const ok = await book(agents.ken, target.id, { note: 'x'.repeat(300) });
    expect(ok.status).toBe(201);
    expect(ok.body.booking.note).toHaveLength(300);
  });

  it('API-16: booking a slot Ken already booked → 409 SLOT_ALREADY_BOOKED; exactly one BOOKED booking remains', async () => {
    const target = await slot('anan', '2030-02-07', '10:00');
    expect((await book(agents.ken, target.id)).status).toBe(201);

    const res = await book(agents.ploy, target.id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'SLOT_ALREADY_BOOKED', message: 'This slot has already been booked.' });
    expect(await bookedCount(target.id)).toBe(1);
    expect(await prisma.booking.count({ where: { slotId: target.id, customerId: ids.ploy } })).toBe(0);
  });

  it('API-17: Ploy and Nina book the same free slot in parallel → one 201 and one 409; one BOOKED row (NFR-04)', async () => {
    const target = await slot('mali', '2030-02-08', '10:00');

    const results = await Promise.all([book(agents.ploy, target.id), book(agents.nina, target.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)?.body.error).toBe('SLOT_ALREADY_BOOKED');
    expect(await bookedCount(target.id)).toBe(1);
  });

  it('API-18: a slot starting in 30 min, a CLOSED slot and a slot of the inactive service → 409 SLOT_NOT_BOOKABLE; unknown slot → 404; nothing stored', async () => {
    const soon = await slot('mali', '2030-02-05', '08:30');
    const closed = await slot('anan', '2030-02-09', '10:00', { status: 'CLOSED' });
    const inactive = await slot('anan', '2030-02-09', '11:00', { service: 'thesis' });
    const before = await prisma.booking.count();

    for (const target of [soon, closed, inactive]) {
      const res = await book(agents.ploy, target.id);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'SLOT_NOT_BOOKABLE', message: 'This slot can no longer be booked.' });
    }
    const missing = await book(agents.ploy, 999_999);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'NOT_FOUND', message: 'Slot not found.' });

    // Binding order (F-04 §1): BR-02 is checked before BR-01, so a closed slot that is also booked is "not bookable".
    const closedBooked = await slot('mali', '2030-02-09', '12:00', { status: 'CLOSED' });
    await makeBooking(prisma, { slotId: closedBooked.id, customerId: ids.ken });
    expect((await book(agents.ploy, closedBooked.id)).body.error).toBe('SLOT_NOT_BOOKABLE');

    expect(await prisma.booking.count()).toBe(before + 1); // only the precondition booking above
  });

  it('API-19: Nina with 3 active future bookings → 409 BOOKING_LIMIT_REACHED; Ploy overlapping her own booking → 409 BOOKING_OVERLAP; nothing stored', async () => {
    // Precondition: neither customer holds an active future booking from the earlier tests of this file.
    await prisma.booking.updateMany({ where: { customerId: { in: [ids.nina, ids.ploy] }, status: 'BOOKED', slot: { startAt: { gt: bkk('2030-02-05', '08:00') } } }, data: { status: 'CANCELLED' } });

    // Two active future bookings plus a cancelled one and a past one (not counted): the third is allowed.
    for (const time of ['08:00', '09:00']) await makeBooking(prisma, { slotId: (await slot('anan', '2030-02-10', time)).id, customerId: ids.nina });
    await makeBooking(prisma, { slotId: (await slot('anan', '2030-02-10', '15:00')).id, customerId: ids.nina, status: 'CANCELLED' });
    await makeBooking(prisma, { slotId: (await slot('anan', '2030-02-01', '09:00')).id, customerId: ids.nina });
    const third = await slot('anan', '2030-02-10', '11:00');
    expect((await book(agents.nina, third.id)).status).toBe(201);

    const fourth = await slot('mali', '2030-02-12', '10:00');
    const overlappingFourth = await slot('mali', '2030-02-10', '11:15');
    const before = await prisma.booking.count();
    const limit = await book(agents.nina, fourth.id);
    expect(limit.status).toBe(409);
    expect(limit.body).toEqual({ error: 'BOOKING_LIMIT_REACHED', message: 'You already have 3 upcoming bookings, the maximum.' });
    // BR-03 is checked before BR-04.
    expect((await book(agents.nina, overlappingFourth.id)).body.error).toBe('BOOKING_LIMIT_REACHED');

    const own = await slot('anan', '2030-02-11', '10:00');
    expect((await book(agents.ploy, own.id)).status).toBe(201);
    const overlapping = await slot('mali', '2030-02-11', '10:15');
    const overlap = await book(agents.ploy, overlapping.id);
    expect(overlap.status).toBe(409);
    expect(overlap.body).toEqual({ error: 'BOOKING_OVERLAP', message: 'You already have a booking at this time.' });
    expect(await prisma.booking.count()).toBe(before + 1); // only Ploy's 10:00 booking

    const backToBack = await slot('mali', '2030-02-11', '10:30');
    expect((await book(agents.ploy, backToBack.id)).status).toBe(201);
  });
});
