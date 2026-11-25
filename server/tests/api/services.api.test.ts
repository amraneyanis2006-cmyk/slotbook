import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 5 Aug 2030 08:00 Bangkok; this file owns the slots of August 2030 and the services it creates.
const NOW = '2030-08-05T08:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, ploy: 0 };
const agents = {} as Record<'anan' | 'mali' | 'ploy', Agent>;
const created: number[] = [];

beforeAll(async () => {
  ids.anan = (await prisma.user.findUniqueOrThrow({ where: { email: 'staff.anan@slotbook.test' } })).id;
  ids.ploy = (await prisma.user.findUniqueOrThrow({ where: { email: 'cust.ploy@slotbook.test' } })).id;
  for (const [name, email] of [['anan', 'staff.anan'], ['mali', 'staff.mali'], ['ploy', 'cust.ploy']] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], `${email}@slotbook.test`);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2030-08-01', '00:00'), bkk('2030-09-01', '00:00'));
  await prisma.slot.deleteMany({ where: { serviceId: { in: created } } });
  await prisma.service.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
});

const create = async (agent: Agent, body: Record<string, unknown>) => {
  const res = await agent.post('/api/staff/services').send(body);
  if (res.status === 201) created.push(res.body.service.id);
  return res;
};
const patch = (agent: Agent, id: number | string, body: Record<string, unknown>) => agent.patch(`/api/staff/services/${id}`).send(body);
const activeNames = async () => ((await agents.ploy.get('/api/services')).body.services as { name: string }[]).map((s) => s.name);

describe('service catalogue (F-11)', () => {
  it('API-31: Staff lists all services with upcomingSlots, creates, renames and changes the duration; the new service is offered and usable; older slots keep their times', async () => {
    const list = await agents.anan.get('/api/staff/services');
    expect(list.status).toBe(200);
    const names = (list.body.services as { name: string; isActive: boolean }[]).map((s) => s.name);
    expect(names).toContain('Thesis consultation'); // inactive services are listed too…
    expect(names.indexOf('Thesis consultation')).toBeGreaterThan(names.indexOf('Academic advising')); // …after the active ones
    expect(list.body.services[0]).toEqual({ id: expect.any(Number), name: expect.any(String), durationMin: expect.any(Number), isActive: true, upcomingSlots: expect.any(Number) });

    const res = await create(agents.anan, { name: '  Visa   letter ', durationMin: 45, isActive: false, id: 999 });
    expect(res.status).toBe(201);
    expect(res.body.service).toEqual({ id: expect.any(Number), name: 'Visa letter', durationMin: 45, isActive: true, upcomingSlots: 0 });
    const id = res.body.service.id as number;
    expect(await activeNames()).toContain('Visa letter');

    const slot = await agents.anan.post('/api/staff/slots').send({ serviceId: id, date: '2030-08-06', startTime: '09:00' });
    expect(slot.status).toBe(201);
    expect(new Date(slot.body.slot.endAt).getTime() - new Date(slot.body.slot.startAt).getTime()).toBe(45 * 60_000);

    const renamed = await patch(agents.mali, id, { name: 'Visa support letter', durationMin: 60 }); // any Staff member (A-06)
    expect(renamed.status).toBe(200);
    expect(renamed.body.service).toEqual({ id, name: 'Visa support letter', durationMin: 60, isActive: true, upcomingSlots: 1 });
    const kept = await prisma.slot.findUniqueOrThrow({ where: { id: slot.body.slot.id } });
    expect(kept.endAt.toISOString()).toBe(slot.body.slot.endAt); // D-04: the slot kept its 45 minutes
    const sameNameOtherCase = await patch(agents.anan, id, { name: 'VISA SUPPORT LETTER' }); // own name, other case
    expect(sameNameOtherCase.status).toBe(200);
  });

  it('API-32: invalid bodies → 422; a used name in another case → 409 SERVICE_NAME_TAKEN; Customer → 403; unknown id → 404; nothing changes', async () => {
    const before = await prisma.service.findMany({ orderBy: { id: 'asc' } });
    const bad = await create(agents.anan, { name: 'ab', durationMin: 10 });
    expect(bad.status).toBe(422);
    expect(bad.body).toEqual({
      error: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.',
      fields: { name: 'Enter a name of 3 to 60 characters.', durationMin: 'Choose a duration from 15 to 120 minutes in 15-minute steps.' },
    });
    const taken = await create(agents.anan, { name: 'academic ADVISING', durationMin: 30 });
    expect(taken.status).toBe(409);
    expect(taken.body).toEqual({ error: 'SERVICE_NAME_TAKEN', message: 'A service with this name already exists.' });

    const advising = before.find((s) => s.name === 'Academic advising')!;
    const document = before.find((s) => s.name === 'Document request')!;
    expect((await patch(agents.anan, document.id, { name: 'Academic Advising' })).body.error).toBe('SERVICE_NAME_TAKEN');
    expect((await patch(agents.anan, advising.id, {})).body.fields).toEqual({ _: 'Change at least one field.' });
    expect((await patch(agents.anan, advising.id, { durationMin: 135 })).status).toBe(422);
    expect((await patch(agents.anan, 999_999, { durationMin: 30 })).status).toBe(404);
    expect((await patch(agents.anan, 'abc', { durationMin: 30 })).status).toBe(404);
    expect((await agents.ploy.get('/api/staff/services')).status).toBe(403);
    expect((await create(agents.ploy, { name: 'Customer service', durationMin: 30 })).status).toBe(403);
    expect((await patch(agents.ploy, advising.id, { isActive: false })).status).toBe(403);
    expect((await request(app).get('/api/staff/services')).status).toBe(401);
    expect(await prisma.service.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });

  it('API-33: deactivating hides the service and its open slots, booking one → 409 SLOT_NOT_BOOKABLE, the existing booking stays; reactivating restores both', async () => {
    const res = await create(agents.anan, { name: 'Deactivation check', durationMin: 30 });
    const id = res.body.service.id as number;
    const open = await makeSlot(prisma, { staffId: ids.anan, serviceId: id, date: '2030-08-07', time: '10:00' });
    const bookedSlot = await makeSlot(prisma, { staffId: ids.anan, serviceId: id, date: '2030-08-07', time: '11:00' });
    const booking = await makeBooking(prisma, { slotId: bookedSlot.id, customerId: ids.ploy });
    const listed = async () => ((await agents.ploy.get('/api/slots/available').query({ date: '2030-08-07' })).body.slots as { id: number }[]).map((s) => s.id);
    expect(await listed()).toContain(open.id);

    const off = await patch(agents.anan, id, { isActive: false });
    expect(off.body.service).toMatchObject({ isActive: false, upcomingSlots: 2 });
    expect(await activeNames()).not.toContain('Deactivation check');
    expect(await listed()).not.toContain(open.id);
    expect((await agents.ploy.post('/api/bookings').send({ slotId: open.id })).body.error).toBe('SLOT_NOT_BOOKABLE');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('BOOKED');
    expect((await patch(agents.anan, id, { isActive: false })).status).toBe(200); // already inactive: no change

    await patch(agents.anan, id, { isActive: true });
    expect(await activeNames()).toContain('Deactivation check');
    expect(await listed()).toContain(open.id);
  });
});
