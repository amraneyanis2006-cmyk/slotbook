import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bkk, freezeClock, loginAs, makeSlot, removeSlotsBetween, unfreezeClock } from '../helpers.js';

// Clock frozen on Mon 7 Apr 2031 07:00 Bangkok; this file owns the slots of April 2031 and its templates.
const NOW = '2031-04-07T07:00:00+07:00';
const app = createApp();
const prisma = new PrismaClient();
const ids = { anan: 0, advising: 0, document: 0, thesis: 0 };
const agents = {} as Record<'anan' | 'mali' | 'ploy', Agent>;

beforeAll(async () => {
  const service = (name: string) => prisma.service.findUniqueOrThrow({ where: { name } }).then((s) => s.id);
  ids.anan = (await prisma.user.findUniqueOrThrow({ where: { email: 'staff.anan@slotbook.test' } })).id;
  Object.assign(ids, { advising: await service('Academic advising'), document: await service('Document request'), thesis: await service('Thesis consultation') });
  for (const [name, email] of [['anan', 'staff.anan'], ['mali', 'staff.mali'], ['ploy', 'cust.ploy']] as const) {
    agents[name] = request.agent(app);
    await loginAs(agents[name], `${email}@slotbook.test`);
  }
});
beforeEach(() => freezeClock(NOW));
afterEach(unfreezeClock);
afterAll(async () => {
  await prisma.availabilityTemplate.deleteMany({ where: { staffId: ids.anan } });
  await removeSlotsBetween(prisma, bkk('2031-04-01', '00:00'), bkk('2031-05-01', '00:00'));
  await prisma.$disconnect();
});

const body = () => ({ name: 'Term weeks', entries: [
  { weekday: 1, startTime: '09:00', serviceId: ids.advising }, { weekday: 3, startTime: '14:00', serviceId: ids.document },
] });

describe('availability templates (F-14)', () => {
  it('API-51: creates a template and generates 2 weeks: accepted slots in one transaction, skipped list with reasons; a second run creates nothing', async () => {
    await makeSlot(prisma, { staffId: ids.anan, serviceId: ids.advising, date: '2031-04-09', time: '14:00' }); // existing overlap (Wed)
    const created = await agents.anan.post('/api/staff/templates').send(body());
    expect(created.status).toBe(201);
    expect(created.body.template).toMatchObject({ name: 'Term weeks', entries: [
      { weekday: 1, startTime: '09:00', service: { id: ids.advising, name: 'Academic advising' } },
      { weekday: 3, startTime: '14:00', service: { id: ids.document, name: 'Document request' } }] });
    const id = created.body.template.id as number;
    expect((await agents.anan.get('/api/staff/templates')).body.templates.map((t: { id: number }) => t.id)).toContain(id);

    const run = await agents.anan.post(`/api/staff/templates/${id}/generate`).send({ from: '2031-04-07', to: '2031-04-20' });
    expect(run.status).toBe(200);
    expect(run.body.created.map((s: { startAt: string }) => s.startAt)).toEqual([
      '2031-04-07T02:00:00.000Z', '2031-04-14T02:00:00.000Z', '2031-04-16T07:00:00.000Z']);
    expect(run.body.created[0]).toMatchObject({ status: 'OPEN', service: { id: ids.advising }, booking: null });
    expect(run.body.skipped).toEqual([{ date: '2031-04-09', startTime: '14:00', service: { id: ids.document, name: 'Document request' }, reason: 'You already have a slot at this time.' }]);
    expect(await prisma.slot.count({ where: { staffId: ids.anan, startAt: { gte: bkk('2031-04-07', '00:00'), lt: bkk('2031-04-21', '00:00') } } })).toBe(4);

    const again = await agents.anan.post(`/api/staff/templates/${id}/generate`).send({ from: '2031-04-07', to: '2031-04-20' });
    expect(again.body.created).toEqual([]);
    expect(again.body.skipped).toHaveLength(4);
    expect(again.body.skipped.every((s: { reason: string }) => s.reason === 'You already have a slot at this time.')).toBe(true);

    const updated = await agents.anan.put(`/api/staff/templates/${id}`).send({ name: 'Term weeks 2', entries: [{ weekday: 5, startTime: '10:00', serviceId: ids.advising }] });
    expect(updated.body.template).toMatchObject({ name: 'Term weeks 2', entries: [{ weekday: 5, startTime: '10:00' }] });
    expect((await agents.anan.delete(`/api/staff/templates/${id}`)).status).toBe(204);
    expect(await prisma.slot.count({ where: { staffId: ids.anan, startAt: { gte: bkk('2031-04-07', '00:00'), lt: bkk('2031-04-21', '00:00') } } })).toBe(4); // slots kept
  });

  it('API-52: another staff member\'s template → 404; Customer → 403; invalid bodies and ranges → 422', async () => {
    const id = (await agents.anan.post('/api/staff/templates').send(body())).body.template.id as number;
    for (const res of [await agents.mali.put(`/api/staff/templates/${id}`).send(body()), await agents.mali.delete(`/api/staff/templates/${id}`),
      await agents.mali.post(`/api/staff/templates/${id}/generate`).send({ from: '2031-04-21', to: '2031-04-22' })]) {
      expect([res.status, res.body.error]).toEqual([404, 'NOT_FOUND']);
    }
    expect((await agents.mali.get('/api/staff/templates')).body.templates.map((t: { id: number }) => t.id)).not.toContain(id);
    expect((await agents.ploy.get('/api/staff/templates')).status).toBe(403);
    const bad = await agents.anan.post('/api/staff/templates').send({ name: 'ab', entries: [] });
    expect(bad.status).toBe(422);
    const inactive = await agents.anan.post('/api/staff/templates').send({ name: 'Old', entries: [{ weekday: 1, startTime: '09:00', serviceId: ids.thesis }] });
    expect(inactive.body.fields).toEqual({ 'entries.0.serviceId': 'Choose an active service.' });
    const long = await agents.anan.post(`/api/staff/templates/${id}/generate`).send({ from: '2031-04-01', to: '2031-05-02' }); // 32 days
    expect(long.body.fields).toEqual({ to: 'Generate at most 31 days at a time.' });
    expect((await agents.anan.post(`/api/staff/templates/${id}/generate`).send({ from: '2031-04-21', to: '2031-04-20' })).body.fields)
      .toEqual({ to: 'The end date must be on or after the start date.' });
    expect((await agents.anan.post('/api/staff/templates/abc/generate').send({ from: '2031-04-21', to: '2031-04-22' })).status).toBe(404);
  });
});
