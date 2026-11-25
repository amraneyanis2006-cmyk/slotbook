import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeBooking, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Wed 15 Jan 2031 12:00 Bangkok; this file owns the slots of January 2031.
const NOW = '2031-01-15T12:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, mali: 0, ploy: 0, advising: 0, document: 0 };
const agents = {} as Record<'anan' | 'ploy', Agent>;

beforeAll(async () => {
  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } }).then((u) => u.id);
  const service = (name: string) => prisma.service.findUniqueOrThrow({ where: { name } }).then((s) => s.id);
  Object.assign(ids, {
    anan: await user('staff.anan@slotbook.test'), mali: await user('staff.mali@slotbook.test'), ploy: await user('cust.ploy@slotbook.test'),
    advising: await service('Academic advising'), document: await service('Document request'),
  });
  for (const [name, email] of [['anan', 'staff.anan'], ['ploy', 'cust.ploy']] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], `${email}@slotbook.test`);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await removeSlotsBetween(prisma, bkk('2031-01-01', '00:00'), bkk('2031-02-01', '00:00'));
  await prisma.$disconnect();
});

type Opts = { status?: 'OPEN' | 'CLOSED' | 'CANCELLED'; service?: 'advising' | 'document'; booking?: 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' };
async function mk(staff: 'anan' | 'mali', date: string, time: string, opts: Opts = {}) {
  const s = await makeSlot(prisma, { staffId: ids[staff], serviceId: ids[opts.service ?? 'advising'], date, time, status: opts.status });
  if (opts.booking) await makeBooking(prisma, { slotId: s.id, customerId: ids.ploy, status: opts.booking });
  return s;
}
const dash = (agent: Agent, from: string, to: string) => agent.get('/api/staff/dashboard').query({ from, to });

describe('GET /api/staff/dashboard (F-15)', () => {
  it('API-50: only the caller\'s non-cancelled slots in [from, to] by Bangkok date; cancelled bookings ignored; 403; 422; 92 days allowed', async () => {
    await mk('anan', '2031-01-06', '00:00', { booking: 'COMPLETED' }); // first minute of the period
    await mk('anan', '2031-01-07', '09:00', { service: 'document', booking: 'NO_SHOW' });
    await mk('anan', '2031-01-08', '09:00', { service: 'document', booking: 'COMPLETED' });
    await mk('anan', '2031-01-15', '09:00', { booking: 'BOOKED' }); // started, not recorded
    await mk('anan', '2031-01-16', '09:00', { booking: 'BOOKED' }); // future
    await mk('anan', '2031-01-09', '09:00', { booking: 'CANCELLED' }); // open again
    await mk('anan', '2031-01-10', '09:00', { status: 'CLOSED' });
    await mk('anan', '2031-01-11', '09:00', { status: 'CANCELLED', booking: 'CANCELLED' }); // not counted
    await mk('anan', '2031-01-05', '23:45', { booking: 'COMPLETED' }); // day before the period
    await mk('anan', '2031-01-20', '00:00'); // day after the period
    await mk('mali', '2031-01-08', '10:00', { booking: 'NO_SHOW' }); // another staff member

    const res = await dash(agents.anan, '2031-01-06', '2031-01-19');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      from: '2031-01-06', to: '2031-01-19',
      slots: { total: 7, booked: 5, open: 1, closed: 1 },
      outcomes: { completed: 2, noShow: 1, pending: 1 },
      noShowRate: 0.333,
      perService: [
        { serviceId: ids.advising, name: 'Academic advising', bookings: 3 },
        { serviceId: ids.document, name: 'Document request', bookings: 2 },
      ],
    });

    expect((await dash(agents.ploy, '2031-01-06', '2031-01-19')).status).toBe(403);
    expect((await request(app).get('/api/staff/dashboard').query({ from: '2031-01-06', to: '2031-01-19' })).status).toBe(401);
    expect((await dash(agents.anan, '2031-01-19', '2031-01-06')).body.fields).toEqual({ to: 'The end date must be on or after the start date.' });
    expect((await dash(agents.anan, '2030-10-01', '2031-01-01')).body.fields).toEqual({ to: 'Choose a period of at most 92 days.' }); // 93 days
    expect((await dash(agents.anan, '2030-10-02', '2031-01-01')).status).toBe(200); // 92 days
    expect((await agents.anan.get('/api/staff/dashboard').query({ from: 'x' })).body.fields)
      .toEqual({ from: 'Enter a valid date (YYYY-MM-DD).', to: 'Enter a valid date (YYYY-MM-DD).' });
  });
});
