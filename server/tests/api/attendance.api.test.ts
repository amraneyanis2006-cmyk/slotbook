import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 7 Oct 2030 10:00 Bangkok; this file owns the slots of October 2030.
const NOW = '2030-10-07T10:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, mali: 0, ploy: 0, ken: 0, advising: 0 };
const agents = {} as Record<'anan' | 'mali' | 'ploy', Agent>;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  Object.assign(ids, {
    anan: await user('staff.anan@slotbook.test'), mali: await user('staff.mali@slotbook.test'),
    ploy: await user('cust.ploy@slotbook.test'), ken: await user('cust.ken@slotbook.test'),
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
  await removeSlotsBetween(prisma, bkk('2030-10-01', '00:00'), bkk('2030-11-01', '00:00'));
  await prisma.$disconnect();
});

async function bookingAt(date: string, time: string, status: 'BOOKED' | 'CANCELLED' | 'COMPLETED' = 'BOOKED', customer: 'ploy' | 'ken' = 'ploy') {
  const slot = await makeSlot(prisma, { staffId: ids.anan, serviceId: ids.advising, date, time });
  return makeBooking(prisma, { slotId: slot.id, customerId: ids[customer], status });
}
const outcome = (agent: Agent, reference: string, value: unknown) =>
  agent.post(`/api/staff/bookings/${reference}/outcome`).send({ outcome: value });
const historyCount = (bookingId: number) => prisma.bookingStatusChange.count({ where: { bookingId } });

describe('record an outcome (F-09)', () => {
  it('API-40: the slot\'s staff member records COMPLETED and NO_SHOW after the start (exactly at the start allowed), with a history row', async () => {
    const done = await bookingAt('2030-10-07', '09:00');
    const atStart = await bookingAt('2030-10-07', '10:00', 'BOOKED', 'ken'); // starts exactly now

    const res = await outcome(agents.anan, done.reference.toLowerCase(), 'COMPLETED');
    expect(res.status).toBe(200);
    expect(res.body.booking).toMatchObject({ reference: done.reference, status: 'COMPLETED', customer: { id: ids.ploy, name: 'Ploy Chai' } });
    expect(res.body.history.at(-1)).toEqual({
      at: '2030-10-07T03:00:00.000Z', from: 'BOOKED', to: 'COMPLETED', actor: { name: 'Anan Wong', role: 'STAFF' }, reason: null,
    });
    const noShow = await outcome(agents.anan, atStart.reference, 'NO_SHOW');
    expect(noShow.status).toBe(200);
    expect(noShow.body.booking.status).toBe('NO_SHOW');
    expect(await prisma.bookingStatusChange.findFirst({ where: { bookingId: atStart.id } }))
      .toMatchObject({ fromStatus: 'BOOKED', toStatus: 'NO_SHOW', actorId: ids.anan });
  });

  it('API-41: too early → 409 OUTCOME_TOO_EARLY; not BOOKED → 409 BOOKING_NOT_ACTIVE; another staff member → 404; Customer → 403; bad outcome → 422; nothing changes', async () => {
    const soon = await bookingAt('2030-10-07', '10:01'); // starts in 1 minute
    const cancelled = await bookingAt('2030-10-07', '08:00', 'CANCELLED');
    const completed = await bookingAt('2030-10-07', '08:30', 'COMPLETED');
    const started = await bookingAt('2030-10-07', '07:30');

    const early = await outcome(agents.anan, soon.reference, 'COMPLETED');
    expect(early.status).toBe(409);
    expect(early.body).toEqual({ error: 'OUTCOME_TOO_EARLY', message: 'An outcome can be recorded only after the booking starts.' });
    for (const b of [cancelled, completed]) {
      expect((await outcome(agents.anan, b.reference, 'NO_SHOW')).body.error).toBe('BOOKING_NOT_ACTIVE');
    }
    const other = await outcome(agents.mali, started.reference, 'NO_SHOW');
    expect(other.status).toBe(404);
    expect(other.body).toEqual({ error: 'NOT_FOUND', message: 'Booking not found.' });
    expect((await outcome(agents.ploy, started.reference, 'NO_SHOW')).status).toBe(403);
    const bad = await outcome(agents.anan, started.reference, 'BOOKED');
    expect(bad.status).toBe(422);
    expect(bad.body.fields).toEqual({ outcome: 'Choose Completed or No-show.' });

    for (const b of [soon, started]) {
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('BOOKED');
      expect(await historyCount(b.id)).toBe(0);
    }
    // Double submission: the second answer is BOOKING_NOT_ACTIVE.
    expect((await outcome(agents.anan, started.reference, 'NO_SHOW')).status).toBe(200);
    expect((await outcome(agents.anan, started.reference, 'COMPLETED')).body.error).toBe('BOOKING_NOT_ACTIVE');
    expect(await historyCount(started.id)).toBe(1);
  });

  it('API-42: the schedule marks only started BOOKED bookings with canRecordOutcome; the customer then lists the booking as past with its status', async () => {
    const started = await bookingAt('2030-10-08', '09:00');
    const future = await bookingAt('2030-10-08', '11:00', 'BOOKED', 'ken');
    freezeClock('2030-10-08T10:00:00+07:00');
    const day = await agents.anan.get('/api/staff/schedule').query({ date: '2030-10-08' });
    const byRef = Object.fromEntries((day.body.slots as { booking: { reference: string; canRecordOutcome: boolean } | null }[])
      .filter((s) => s.booking).map((s) => [s.booking!.reference, s.booking!.canRecordOutcome]));
    expect(byRef).toEqual({ [started.reference]: true, [future.reference]: false });

    await outcome(agents.anan, started.reference, 'NO_SHOW');
    const after = await agents.anan.get('/api/staff/schedule').query({ date: '2030-10-08' });
    const recorded = (after.body.slots as { booking: { reference: string; status: string; canRecordOutcome: boolean } | null }[])
      .find((s) => s.booking?.reference === started.reference)!.booking!;
    expect(recorded).toMatchObject({ status: 'NO_SHOW', canRecordOutcome: false });
    expect(after.body.summary.booked).toBe(2); // F-06: a slot with a NO_SHOW booking still counts as booked

    const mine = await agents.ploy.get('/api/bookings/mine');
    expect((mine.body.past as { reference: string; status: string }[]).find((b) => b.reference === started.reference)?.status).toBe('NO_SHOW');
  });
});
