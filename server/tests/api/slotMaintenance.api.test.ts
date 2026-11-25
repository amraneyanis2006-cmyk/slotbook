import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 2 Sep 2030 08:00 Bangkok; this file owns the slots of September 2030.
const NOW = '2030-09-02T08:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, mali: 0, ploy: 0, advising: 0 };
const agents = {} as Record<'anan' | 'mali' | 'ploy', Agent>;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  Object.assign(ids, {
    anan: await user('staff.anan@slotbook.test'), mali: await user('staff.mali@slotbook.test'), ploy: await user('cust.ploy@slotbook.test'),
    advising: (await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } })).id,
  });
  for (const [name, email] of [['anan', 'staff.anan'], ['mali', 'staff.mali'], ['ploy', 'cust.ploy']] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], `${email}@slotbook.test`);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2030-09-01', '00:00'), bkk('2030-10-01', '00:00'));
  await prisma.$disconnect();
});

const anans = (date: string, time: string, status: 'OPEN' | 'CLOSED' | 'CANCELLED' = 'OPEN', durationMin = 30) =>
  makeSlot(prisma, { staffId: ids.anan, serviceId: ids.advising, date, time, status, durationMin });
const edit = (agent: Agent, id: number | string, body: Record<string, unknown>) => agent.patch(`/api/staff/slots/${id}`).send(body);
const act = (agent: Agent, id: number | string, action: 'close' | 'reopen' | 'cancel', body: Record<string, unknown> = {}) =>
  agent.post(`/api/staff/slots/${id}/${action}`).send(body);
const row = (id: number) => prisma.slot.findUniqueOrThrow({ where: { id } });

describe('edit time (F-07)', () => {
  it('API-35: moves an own unbooked slot keeping its duration; BR-06 → 422; BR-07 → 409 SLOT_OVERLAP; +15 min within its own range is allowed', async () => {
    const slot = await anans('2030-09-03', '09:00', 'OPEN', 45); // 45 min although Academic advising lasts 30 (D-04 copy)
    await anans('2030-09-03', '11:00');
    const moved = await edit(agents.anan, slot.id, { date: '2030-09-04', startTime: '10:15', staffId: ids.mali });
    expect(moved.status).toBe(200);
    expect(moved.body.slot).toMatchObject({ id: slot.id, status: 'OPEN', startAt: '2030-09-04T03:15:00.000Z', endAt: '2030-09-04T04:00:00.000Z', booking: null });
    expect((await row(slot.id)).staffId).toBe(ids.anan);

    const past = await edit(agents.anan, slot.id, { date: '2030-09-01', startTime: '09:00' });
    expect(past.status).toBe(422);
    expect(past.body.fields).toEqual({ startTime: 'The slot must start in the future.' });
    expect((await edit(agents.anan, slot.id, { date: '2030-09-04', startTime: '07:45' })).body.fields)
      .toEqual({ startTime: 'Slots must be within opening hours (08:00–18:00).' });

    const back = await edit(agents.anan, slot.id, { date: '2030-09-03', startTime: '09:00' });
    expect(back.status).toBe(200);
    const overlap = await edit(agents.anan, slot.id, { date: '2030-09-03', startTime: '10:30' }); // 10:30–11:15 vs 11:00
    expect(overlap.status).toBe(409);
    expect(overlap.body).toEqual({ error: 'SLOT_OVERLAP', message: 'You already have a slot at this time.' });
    expect((await edit(agents.anan, slot.id, { date: '2030-09-03', startTime: '09:15' })).status).toBe(200); // overlaps only itself
    expect((await row(slot.id)).startAt.toISOString()).toBe('2030-09-03T02:15:00.000Z');
  });

  it('API-36: close hides and blocks an open slot; reopen makes it listed and bookable again', async () => {
    const slot = await anans('2030-09-05', '09:00');
    const listed = async () => ((await agents.ploy.get('/api/slots/available').query({ date: '2030-09-05' })).body.slots as { id: number }[]).map((s) => s.id);
    expect(await listed()).toContain(slot.id);

    const closed = await act(agents.anan, slot.id, 'close');
    expect(closed.status).toBe(200);
    expect(closed.body.slot).toMatchObject({ id: slot.id, status: 'CLOSED' });
    expect(await listed()).not.toContain(slot.id);
    expect((await agents.ploy.post('/api/bookings').send({ slotId: slot.id })).body.error).toBe('SLOT_NOT_BOOKABLE');

    const reopened = await act(agents.anan, slot.id, 'reopen');
    expect(reopened.body.slot).toMatchObject({ status: 'OPEN' });
    expect(await listed()).toContain(slot.id);
    expect((await agents.ploy.post('/api/bookings').send({ slotId: slot.id })).status).toBe(201);
  });

  it('API-37: editing or closing a booked slot → 409 SLOT_HAS_BOOKING; slot and booking unchanged', async () => {
    const slot = await anans('2030-09-06', '09:00');
    const booking = await makeBooking(prisma, { slotId: slot.id, customerId: ids.ploy });
    const before = await row(slot.id);
    for (const res of [await edit(agents.anan, slot.id, { date: '2030-09-06', startTime: '10:00' }), await act(agents.anan, slot.id, 'close')]) {
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'SLOT_HAS_BOOKING', message: 'This slot is booked. Cancel it with a reason instead.' });
    }
    expect(await row(slot.id)).toEqual(before);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('BOOKED');
  });
});

describe('cancel with reason (F-07, BR-14 cascade)', () => {
  it('API-38: cancelling a booked slot cancels the booking in the same transaction with a history row carrying the reason; the customer sees it; no reason → 422', async () => {
    const slot = await anans('2030-09-09', '09:00');
    const booked = await agents.ploy.post('/api/bookings').send({ slotId: slot.id });
    const ref = booked.body.booking.reference as string;

    const noReason = await act(agents.anan, slot.id, 'cancel', { reason: '  ab ' });
    expect(noReason.status).toBe(422);
    expect(noReason.body.fields).toEqual({ reason: 'Enter a reason of 3 to 200 characters.' });
    expect((await act(agents.anan, slot.id, 'cancel', { reason: 'x'.repeat(201) })).status).toBe(422);
    expect((await row(slot.id)).status).toBe('OPEN');

    freezeClock('2030-09-08T17:00:00+07:00'); // staff may cancel inside the customer's 24 h window
    const res = await act(agents.anan, slot.id, 'cancel', { reason: ' Staff illness ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ slot: expect.objectContaining({ id: slot.id, status: 'CANCELLED', booking: null }), cancelledBooking: ref });
    const booking = await prisma.booking.findUniqueOrThrow({ where: { reference: ref } });
    expect(booking).toMatchObject({ status: 'CANCELLED', cancelledById: ids.anan });
    expect(booking.cancelledAt?.toISOString()).toBe('2030-09-08T10:00:00.000Z');

    const detail = await agents.ploy.get(`/api/bookings/${ref}`);
    expect(detail.body.booking.status).toBe('CANCELLED');
    expect(detail.body.history.at(-1)).toEqual({
      at: '2030-09-08T10:00:00.000Z', from: 'BOOKED', to: 'CANCELLED', actor: { name: 'Anan Wong', role: 'STAFF' }, reason: 'Staff illness',
    });
    // An unbooked slot is cancelled too (reason still required); cancelledBooking is null.
    const free = await anans('2030-09-09', '10:00');
    expect((await act(agents.anan, free.id, 'cancel', { reason: 'Office closed' })).body).toMatchObject({ cancelledBooking: null, slot: { status: 'CANCELLED' } });
  });

  it('API-39: a started or CANCELLED slot → 409 SLOT_NOT_EDITABLE; another staff member\'s slot → 404 unchanged; Customer → 403; a bad id → 404', async () => {
    const started = await anans('2030-09-02', '07:45');
    const cancelled = await anans('2030-09-10', '09:00', 'CANCELLED');
    for (const id of [started.id, cancelled.id]) {
      for (const res of [
        await edit(agents.anan, id, { date: '2030-09-11', startTime: '09:00' }), await act(agents.anan, id, 'close'),
        await act(agents.anan, id, 'reopen'), await act(agents.anan, id, 'cancel', { reason: 'Too late' }),
      ]) {
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'SLOT_NOT_EDITABLE', message: 'This slot can no longer be changed.' });
      }
    }
    const malis = await makeSlot(prisma, { staffId: ids.mali, serviceId: ids.advising, date: '2030-09-10', time: '10:00' });
    const before = await row(malis.id);
    for (const res of [
      await edit(agents.anan, malis.id, { date: '2030-09-11', startTime: '09:00' }), await act(agents.anan, malis.id, 'close'),
      await act(agents.anan, malis.id, 'cancel', { reason: 'Not mine' }),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'NOT_FOUND', message: 'Slot not found.' });
    }
    expect(await row(malis.id)).toEqual(before);
    expect((await act(agents.ploy, malis.id, 'close')).status).toBe(403);
    expect((await edit(agents.ploy, malis.id, { date: '2030-09-11', startTime: '09:00' })).status).toBe(403);
    expect((await act(agents.anan, 'abc', 'close')).status).toBe(404);
    expect((await edit(agents.anan, 0, { date: '2030-09-11', startTime: '09:00' })).status).toBe(404);
  });
});
