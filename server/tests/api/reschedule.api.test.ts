import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 4 Nov 2030 08:00 Bangkok; this file owns the slots of November 2030.
const NOW = '2030-11-04T08:00:00+07:00';
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
  await removeSlotsBetween(prisma, bkk('2030-11-01', '00:00'), bkk('2030-12-01', '00:00'));
  await prisma.$disconnect();
});

type Svc = 'advising' | 'document' | 'thesis';
const slot = (staff: 'anan' | 'mali', date: string, time: string, extra: { status?: 'OPEN' | 'CLOSED'; service?: Svc } = {}) => {
  const service = extra.service ?? 'advising';
  return makeSlot(prisma, { staffId: ids[staff], serviceId: ids[service], date, time, status: extra.status, durationMin: { advising: 30, document: 15, thesis: 60 }[service] });
};
/** A booking made through the API, so it has its creation history row. */
async function booked(agent: Agent, staff: 'anan' | 'mali', date: string, time: string, note?: string) {
  const s = await slot(staff, date, time);
  const res = await agent.post('/api/bookings').send({ slotId: s.id, note });
  expect(res.status).toBe(201);
  return { slot: s, reference: res.body.booking.reference as string };
}
const move = (agent: Agent, reference: string, slotId: unknown) => agent.post(`/api/bookings/${reference}/reschedule`).send({ slotId });
const snapshot = async (reference: string) => ({
  booking: await prisma.booking.findUniqueOrThrow({ where: { reference } }),
  history: await prisma.bookingStatusChange.count({ where: { booking: { reference } } }),
  bookings: await prisma.booking.count(),
});

describe('reschedule (F-08)', () => {
  it('API-43: moves an own booking ≥ 24 h ahead to a free slot of the same service: old CANCELLED, new BOOKED with a new reference and the note, history reasons, old slot listed again', async () => {
    const old = await booked(agents.ploy, 'anan', '2030-11-06', '09:00', 'Credit transfer');
    const target = await slot('mali', '2030-11-07', '10:00');
    const res = await move(agents.ploy, old.reference.toLowerCase(), target.id);
    expect(res.status).toBe(201);
    expect(res.body.previous).toBe(old.reference);
    const fresh = res.body.booking;
    expect(fresh).toMatchObject({ status: 'BOOKED', note: 'Credit transfer', slot: { id: target.id } });
    expect(fresh.reference).not.toBe(old.reference);

    const oldRow = await prisma.booking.findUniqueOrThrow({ where: { reference: old.reference } });
    expect(oldRow).toMatchObject({ status: 'CANCELLED', cancelledById: ids.ploy });
    const oldHistory = (await agents.ploy.get(`/api/bookings/${old.reference}`)).body.history;
    expect(oldHistory.at(-1)).toMatchObject({ from: 'BOOKED', to: 'CANCELLED', actor: { name: 'Ploy Chai', role: 'CUSTOMER' }, reason: `Rescheduled to ${fresh.reference}` });
    const newHistory = (await agents.ploy.get(`/api/bookings/${fresh.reference}`)).body.history;
    expect(newHistory).toEqual([{ at: '2030-11-04T01:00:00.000Z', from: null, to: 'BOOKED', actor: { name: 'Ploy Chai', role: 'CUSTOMER' }, reason: `Rescheduled from ${old.reference}` }]);

    const listed = (await agents.ken.get('/api/slots/available').query({ date: '2030-11-06' })).body.slots.map((s: { id: number }) => s.id);
    expect(listed).toContain(old.slot.id);
  });

  it('API-44: a target that fails BR-01/BR-02/BR-03/BR-04 gets the F-04 code and nothing changes (BR-16)', async () => {
    const old = await booked(agents.ken, 'anan', '2030-11-08', '09:00');
    const before = await snapshot(old.reference);
    const targets: number[] = [];
    const expectRefused = async (slotId: number, code: string) => {
      targets.push(slotId);
      const res = await move(agents.ken, old.reference, slotId);
      expect([res.status, res.body.error]).toEqual([409, code]);
    };

    await expectRefused((await slot('mali', '2030-11-08', '10:00', { status: 'CLOSED' })).id, 'SLOT_NOT_BOOKABLE');
    await expectRefused((await slot('mali', '2030-11-04', '08:45')).id, 'SLOT_NOT_BOOKABLE'); // 45 min ahead
    const taken = await slot('mali', '2030-11-08', '12:00');
    await makeBooking(prisma, { slotId: taken.id, customerId: ids.ken }); // BR-01 is checked before BR-03/BR-04
    await expectRefused(taken.id, 'SLOT_ALREADY_BOOKED');
    await booked(agents.ken, 'mali', '2030-11-09', '09:00');
    await expectRefused((await slot('anan', '2030-11-09', '09:15')).id, 'BOOKING_OVERLAP');
    await makeBooking(prisma, { slotId: (await slot('mali', '2030-11-10', '09:00')).id, customerId: ids.ken }); // the API would refuse a 4th
    // Ken now holds 3 active bookings besides the old one (12:00 test data, 9 and 10 Nov): BR-03.
    await expectRefused((await slot('anan', '2030-11-12', '09:00')).id, 'BOOKING_LIMIT_REACHED');

    const after = await snapshot(old.reference);
    expect(after.booking).toEqual(before.booking);
    expect(after.history).toBe(before.history);
    expect(await prisma.booking.count({ where: { slotId: { in: targets.filter((t) => t !== taken.id) }, customerId: ids.ken } })).toBe(0);
  });

  it('API-44: a target whose service was deactivated → 409 SLOT_NOT_BOOKABLE, nothing changes', async () => {
    const temp = await prisma.service.create({ data: { name: 'API-44 temporary service', durationMin: 30 } });
    try {
      const oldSlot = await makeSlot(prisma, { staffId: ids.anan, serviceId: temp.id, date: '2030-11-18', time: '09:00' });
      const old = await agents.nina.post('/api/bookings').send({ slotId: oldSlot.id });
      const target = await makeSlot(prisma, { staffId: ids.mali, serviceId: temp.id, date: '2030-11-18', time: '10:00' });
      await prisma.service.update({ where: { id: temp.id }, data: { isActive: false } });
      const before = await snapshot(old.body.booking.reference);
      expect((await move(agents.nina, old.body.booking.reference, target.id)).body.error).toBe('SLOT_NOT_BOOKABLE');
      expect(await snapshot(old.body.booking.reference)).toEqual(before);
    } finally {
      await removeSlotsBetween(prisma, bkk('2030-11-18', '00:00'), bkk('2030-11-19', '00:00'));
      await prisma.service.delete({ where: { id: temp.id } });
    }
  });

  it('API-45: the old booking is excluded: a customer with 3 active bookings can move one; a move 15 minutes later overlapping the old time is allowed', async () => {
    const old = await booked(agents.nina, 'anan', '2030-11-13', '09:00');
    await booked(agents.nina, 'anan', '2030-11-14', '09:00');
    await booked(agents.nina, 'anan', '2030-11-15', '09:00');
    const later = await slot('mali', '2030-11-13', '09:15');
    const res = await move(agents.nina, old.reference, later.id);
    expect(res.status).toBe(201);
    const third = await slot('mali', '2030-11-13', '10:00');
    expect((await move(agents.nina, res.body.booking.reference, third.id)).status).toBe(201);
  });

  it('API-46: inside 24 h → 409 CANCELLATION_WINDOW_CLOSED (exactly 24 h allowed); not active → 409; other customer → 404; same slot / other service → 422; unknown slot → 404; Staff → 403', async () => {
    const exactly = await booked(agents.ploy, 'anan', '2030-11-05', '08:00'); // exactly 24 h ahead
    const inside = await booked(agents.ploy, 'anan', '2030-11-05', '08:30');
    const target = await slot('mali', '2030-11-20', '09:00');
    const target2 = await slot('mali', '2030-11-20', '10:00');
    freezeClock('2030-11-04T08:31:00+07:00'); // inside: 23 h 59 min
    const late = await move(agents.ploy, inside.reference, target.id);
    expect(late.status).toBe(409);
    expect(late.body).toEqual({ error: 'CANCELLATION_WINDOW_CLOSED', message: 'Cancellation closes 24 hours before the start.' });
    freezeClock(NOW);
    expect((await move(agents.ploy, exactly.reference, target.id)).status).toBe(201);
    expect((await move(agents.ploy, exactly.reference, target2.id)).body.error).toBe('BOOKING_NOT_ACTIVE');

    expect((await move(agents.ken, inside.reference, target2.id)).status).toBe(404);
    const same = await move(agents.ploy, inside.reference, inside.slot.id);
    expect([same.status, same.body.fields]).toEqual([422, { slotId: 'Choose a different slot.' }]);
    const doc = await slot('mali', '2030-11-20', '11:00', { service: 'document' });
    expect((await move(agents.ploy, inside.reference, doc.id)).body.fields).toEqual({ slotId: 'Choose a slot of the same service.' });
    const missing = await move(agents.ploy, inside.reference, 2_000_000_000);
    expect([missing.status, missing.body.message]).toEqual([404, 'Slot not found.']);
    expect((await move(agents.ploy, inside.reference, 'x')).status).toBe(422);
    expect((await move(agents.anan, inside.reference, target2.id)).status).toBe(403);
    expect((await prisma.booking.findUniqueOrThrow({ where: { reference: inside.reference } })).status).toBe('BOOKED');
  });
});
