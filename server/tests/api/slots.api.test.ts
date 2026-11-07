import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { formatReference } from '../../src/rules/bookingRules.js';
import { freezeClock, loginAs, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 7 Jan 2030 08:00 Bangkok: far from the seed data, so each test owns its dates.
const NOW = '2030-01-07T08:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, mali: 0, ploy: 0, advising: 0, thesis: 0 };
let anan: Agent;
let mali: Agent;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  const service = (name: string) => prisma.service.findUniqueOrThrow({ where: { name } }).then((s) => s.id);
  Object.assign(ids, {
    anan: await user('staff.anan@slotbook.test'), mali: await user('staff.mali@slotbook.test'),
    ploy: await user('cust.ploy@slotbook.test'), advising: await service('Academic advising'), thesis: await service('Thesis consultation'),
  });
  anan = request.agent(app);
  mali = request.agent(app);
  await loginAs(anan, 'staff.anan@slotbook.test');
  await loginAs(mali, 'staff.mali@slotbook.test');
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(() => prisma.$disconnect());

const post = (agent: Agent, date: string, startTime: string, serviceId = ids.advising) =>
  agent.post('/api/staff/slots').send({ serviceId, date, startTime });
const bkk = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);

describe('POST /api/staff/slots, GET /api/staff/slots (F-03)', () => {
  it('API-10: a valid slot is created for the session staff member, OPEN, end = start + duration, and listed', async () => {
    const res = await post(anan, '2030-01-08', '09:30');

    expect(res.status).toBe(201);
    expect(res.body.slot).toEqual({
      id: expect.any(Number),
      startAt: '2030-01-08T02:30:00.000Z',
      endAt: '2030-01-08T03:00:00.000Z',
      status: 'OPEN',
      service: { id: ids.advising, name: 'Academic advising', durationMin: 30 },
      booking: null,
    });
    const row = await prisma.slot.findUniqueOrThrow({ where: { id: res.body.slot.id } });
    expect(row).toMatchObject({ staffId: ids.anan, status: 'OPEN', endAt: new Date(row.startAt.getTime() + 30 * 60_000) });

    const list = await anan.get('/api/staff/slots');
    expect(list.status).toBe(200);
    expect(list.body.slots.map((s: { id: number }) => s.id)).toContain(res.body.slot.id);
  });

  it('API-11: past, off-step, out-of-hours, inactive-service and incomplete slots → 422 VALIDATION_ERROR with the field; nothing stored', async () => {
    const before = await prisma.slot.count();
    const cases: [Record<string, unknown>, string][] = [
      [{ serviceId: ids.advising, date: '2030-01-06', startTime: '09:00' }, 'startTime'],
      [{ serviceId: ids.advising, date: '2030-01-09', startTime: '09:10' }, 'startTime'],
      [{ serviceId: ids.advising, date: '2030-01-09', startTime: '07:45' }, 'startTime'],
      [{ serviceId: ids.advising, date: '2030-01-09', startTime: '17:45' }, 'startTime'],
      [{ serviceId: ids.thesis, date: '2030-01-09', startTime: '09:00' }, 'serviceId'],
      [{ date: '2030-01-09', startTime: '09:00' }, 'serviceId'],
      [{ serviceId: ids.advising, startTime: '09:00' }, 'date'],
      [{ serviceId: ids.advising, date: '2030-01-09' }, 'startTime'],
    ];
    for (const [body, field] of cases) {
      const res = await anan.post('/api/staff/slots').send(body);
      expect(res.status, JSON.stringify(body)).toBe(422);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.fields, JSON.stringify(body)).toHaveProperty(field);
    }
    expect(await prisma.slot.count()).toBe(before);
  });

  it('API-12: own overlap → 409 SLOT_OVERLAP; same time for another staff and touching slots are accepted; parallel overlap → one 201, one 409', async () => {
    expect((await post(anan, '2030-01-10', '09:00')).status).toBe(201);

    const overlap = await post(anan, '2030-01-10', '09:15');
    expect(overlap.status).toBe(409);
    expect(overlap.body).toEqual({ error: 'SLOT_OVERLAP', message: 'You already have a slot at this time.' });
    expect((await post(mali, '2030-01-10', '09:15')).status).toBe(201);
    expect((await post(anan, '2030-01-10', '09:30')).status).toBe(201);

    const parallel = await Promise.all([post(anan, '2030-01-10', '11:00'), post(anan, '2030-01-10', '11:15')]);
    expect(parallel.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.slot.count({ where: { staffId: ids.anan, startAt: { gte: bkk('2030-01-10', '11:00'), lt: bkk('2030-01-10', '11:30') } } })).toBe(1);
  });

  it('API-13: lists only the caller\'s upcoming non-cancelled slots, ordered, with booking reference and customer name', async () => {
    const make = (staffId: number, date: string, time: string, status: 'OPEN' | 'CANCELLED' = 'OPEN') =>
      prisma.slot.create({ data: { staffId, serviceId: ids.advising, startAt: bkk(date, time), endAt: new Date(bkk(date, time).getTime() + 30 * 60_000), status } });
    const later = await make(ids.anan, '2030-01-12', '10:00');
    const booked = await make(ids.anan, '2030-01-12', '09:00');
    const past = await make(ids.anan, '2030-01-06', '09:00');
    const cancelled = await make(ids.anan, '2030-01-12', '11:00', 'CANCELLED');
    const malis = await make(ids.mali, '2030-01-12', '09:00');
    const [{ seq }] = await prisma.$queryRaw<{ seq: bigint }[]>`SELECT nextval('booking_ref_seq') AS seq`;
    const booking = await prisma.booking.create({ data: { slotId: booked.id, customerId: ids.ploy, reference: formatReference(2030, Number(seq)) } });

    const res = await anan.get('/api/staff/slots');
    expect(res.status).toBe(200);
    const slots: { id: number; startAt: string; booking: unknown }[] = res.body.slots;
    const listed = slots.map((s) => s.id);

    expect(listed).toEqual(expect.arrayContaining([booked.id, later.id]));
    expect(listed).not.toContain(past.id);
    expect(listed).not.toContain(cancelled.id);
    expect(listed).not.toContain(malis.id);
    const owners = await prisma.slot.findMany({ where: { id: { in: listed } }, select: { staffId: true } });
    expect(new Set(owners.map((o) => o.staffId))).toEqual(new Set([ids.anan]));
    expect(slots.every((s) => new Date(s.startAt) >= new Date(NOW))).toBe(true);
    expect(slots.map((s) => s.startAt)).toEqual([...slots.map((s) => s.startAt)].sort());
    expect(listed.indexOf(booked.id)).toBeLessThan(listed.indexOf(later.id));

    expect(slots.find((s) => s.id === booked.id)?.booking).toEqual({
      reference: booking.reference, status: 'BOOKED', customer: { id: ids.ploy, name: 'Ploy Chai' },
    });
    expect(slots.find((s) => s.id === later.id)?.booking).toBeNull();
  });
});
