import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 2 Dec 2030 08:00 Bangkok; this file owns the slots of December 2030.
const NOW = '2030-12-02T08:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, mali: 0, ken: 0, advising: 0, document: 0, thesis: 0, extraStaff: 0 };
const agents = {} as Record<'ploy' | 'anan', Agent>;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  const service = (name: string) => prisma.service.findUniqueOrThrow({ where: { name } }).then((s) => s.id);
  Object.assign(ids, {
    anan: await user('staff.anan@slotbook.test'), mali: await user('staff.mali@slotbook.test'), ken: await user('cust.ken@slotbook.test'),
    advising: await service('Academic advising'), document: await service('Document request'), thesis: await service('Thesis consultation'),
  });
  // A deactivated staff member (test data): their slots are never offered.
  ids.extraStaff = (await prisma.user.create({
    data: { email: 'staff.former@slotbook.test', name: 'Former Staff', role: 'STAFF', isActive: false, passwordHash: 'x' },
  })).id;
  for (const [name, email] of [['ploy', 'cust.ploy'], ['anan', 'staff.anan']] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], `${email}@slotbook.test`);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2030-12-01', '00:00'), bkk('2031-01-01', '00:00'));
  await prisma.user.delete({ where: { id: ids.extraStaff } });
  await prisma.$disconnect();
});

const slot = (staffId: number, serviceId: number, date: string, time: string, status: 'OPEN' | 'CLOSED' = 'OPEN') =>
  makeSlot(prisma, { staffId, serviceId, date, time, status });
const search = (agent: Agent, query: Record<string, string | number>) => agent.get('/api/slots/search').query(query);
const idsOf = (res: request.Response) => (res.body.slots as { id: number }[]).map((s) => s.id);

describe('GET /api/slots/search (F-12)', () => {
  it('API-47: only bookable slots whose Bangkok date is in [from, to], filtered by service and staff, ordered, without customer data', async () => {
    const a1 = await slot(ids.anan, ids.advising, '2030-12-03', '09:00');
    const m1 = await slot(ids.mali, ids.advising, '2030-12-03', '09:00');
    const a2 = await slot(ids.anan, ids.document, '2030-12-04', '17:00');
    const edge = await slot(ids.mali, ids.advising, '2030-12-05', '00:00'); // first minute of the last day
    const outside = await slot(ids.mali, ids.advising, '2030-12-06', '00:00');
    await slot(ids.anan, ids.advising, '2030-12-02', '08:45'); // < 60 min ahead
    await slot(ids.anan, ids.advising, '2030-12-03', '11:00', 'CLOSED');
    await slot(ids.anan, ids.thesis, '2030-12-03', '13:00'); // inactive service
    await slot(ids.extraStaff, ids.advising, '2030-12-03', '14:00'); // deactivated staff
    const booked = await slot(ids.mali, ids.advising, '2030-12-04', '09:00');
    await makeBooking(prisma, { slotId: booked.id, customerId: ids.ken });

    const all = await search(agents.ploy, { from: '2030-12-02', to: '2030-12-05' });
    expect(all.status).toBe(200);
    expect(idsOf(all)).toEqual([a1.id, m1.id, a2.id, edge.id]);
    expect(all.body.truncated).toBe(false);
    expect(all.body.slots[0]).toEqual({
      id: a1.id, startAt: '2030-12-03T02:00:00.000Z', endAt: '2030-12-03T02:30:00.000Z',
      service: { id: ids.advising, name: 'Academic advising', durationMin: 30 }, staff: { id: ids.anan, name: 'Anan Wong' },
    });
    expect(idsOf(all)).not.toContain(outside.id);
    expect(idsOf(await search(agents.ploy, { from: '2030-12-02', to: '2030-12-05', serviceId: ids.advising, staffId: ids.mali }))).toEqual([m1.id, edge.id]);
    expect(idsOf(await search(agents.ploy, { from: '2030-12-04', to: '2030-12-04', staffId: ids.anan }))).toEqual([a2.id]);
    expect(idsOf(await search(agents.ploy, { from: '2030-12-02', to: '2030-12-05', staffId: ids.ken }))).toEqual([]);
    expect(idsOf(await search(agents.ploy, { from: '2030-12-02', to: '2030-12-05', serviceId: 999_999 }))).toEqual([]);
  });

  it('API-48: bad queries → 422 with the §2 messages; Staff → 403; more than 200 matches → 200 slots and truncated', async () => {
    const bad = await search(agents.ploy, { from: '2030-12-10', to: '2030-12-25' });
    expect(bad.status).toBe(422);
    expect(bad.body).toEqual({ error: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields: { to: 'Search at most 14 days at a time.' } });
    expect((await search(agents.ploy, { from: 'x', to: '2030-12-10' })).body.fields).toEqual({ from: 'Enter a valid date (YYYY-MM-DD).' });
    expect((await search(agents.anan, { from: '2030-12-10', to: '2030-12-11' })).status).toBe(403);
    expect((await request(app).get('/api/slots/search').query({ from: '2030-12-10', to: '2030-12-11' })).status).toBe(401);

    // 201 bookable 15-minute Document request slots of Anan on 16–21 Dec, 36 per day (test data, inserted directly).
    const rows = [];
    for (let i = 0; i < 201; i++) {
      const day = 16 + Math.floor(i / 36);
      const minutes = 8 * 60 + (i % 36) * 15;
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      const startAt = bkk(`2030-12-${day}`, time);
      rows.push({ staffId: ids.anan, serviceId: ids.document, startAt, endAt: new Date(startAt.getTime() + 15 * 60_000) });
    }
    await prisma.slot.createMany({ data: rows });
    const many = await search(agents.ploy, { from: '2030-12-16', to: '2030-12-23' });
    expect(many.body.slots).toHaveLength(200);
    expect(many.body.truncated).toBe(true);
  });

  it('API-49: GET /api/staff-members lists active staff by name with id and name only', async () => {
    const res = await agents.ploy.get('/api/staff-members');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ staff: [{ id: ids.anan, name: 'Anan Wong' }, { id: ids.mali, name: 'Mali Srisuk' }] });
    expect((await agents.anan.get('/api/staff-members')).status).toBe(200);
    expect((await request(app).get('/api/staff-members')).status).toBe(401);
  });
});
