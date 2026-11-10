import express from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp, errorHandler } from '../../src/app.js';
import { requireRole } from '../../src/middleware/requireRole.js';
import { addDays, bangkokDate } from '../../src/utils/time.js';
import { loginAs, makeSlot } from '../helpers.js';

type Role = 'CUSTOMER' | 'STAFF';

// F-02 §2 role/permission matrix. Every Issue that adds an endpoint adds its row here (#4 staff, #5-#7 others).
export const PROTECTED_ROUTES: { method: 'get' | 'post'; path: string; roles: Role[] }[] = [
  { method: 'post', path: '/api/auth/logout', roles: ['CUSTOMER', 'STAFF'] },
  { method: 'get', path: '/api/auth/me', roles: ['CUSTOMER', 'STAFF'] },
  { method: 'get', path: '/api/services', roles: ['CUSTOMER', 'STAFF'] },
  { method: 'post', path: '/api/staff/slots', roles: ['STAFF'] },
  { method: 'get', path: '/api/staff/slots', roles: ['STAFF'] },
  { method: 'get', path: '/api/slots/available', roles: ['CUSTOMER'] },
  { method: 'post', path: '/api/bookings', roles: ['CUSTOMER'] },
];

const ACCOUNT: Record<Role, string> = { CUSTOMER: 'cust.ploy@slotbook.test', STAFF: 'staff.anan@slotbook.test' };
const app = createApp();

describe('API-06 authentication required (F-02, NFR-01)', () => {
  for (const route of PROTECTED_ROUTES) {
    it(`API-06: ${route.method.toUpperCase()} ${route.path} without a session → 401 UNAUTHENTICATED { error, message }`, async () => {
      const res = await request(app)[route.method](route.path);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHENTICATED');
      expect(Object.keys(res.body).sort()).toEqual(['error', 'message']);
    });
  }
});

describe('API-07 role restriction (F-02, NFR-02)', () => {
  it('API-07: requireRole answers another role with 403 FORBIDDEN and only { error, message }', async () => {
    const probe = express();
    probe.get('/probe', (req, _res, next) => { req.user = { id: 1, name: 'Ploy Chai', email: 'p@x', role: 'CUSTOMER' }; next(); },
      requireRole('STAFF'), (_req, res) => { res.json({ secret: 'resource data' }); });
    probe.use(errorHandler);

    const res = await request(probe).get('/probe');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN', message: 'You do not have access to this operation.' });
  });

  for (const route of PROTECTED_ROUTES.filter((r) => r.roles.length === 1)) {
    const other: Role = route.roles[0] === 'STAFF' ? 'CUSTOMER' : 'STAFF';
    it(`API-07: ${route.method.toUpperCase()} ${route.path} as ${other} → 403 FORBIDDEN`, async () => {
      const agent = request.agent(app);
      await loginAs(agent, ACCOUNT[other]);
      const res = await agent[route.method](route.path);
      expect(res.status).toBe(403);
      expect(Object.keys(res.body).sort()).toEqual(['error', 'message']);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  }
});

describe('API-08 server-side identity (F-02, BR-08)', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());

  it('API-08: staffId in the body is ignored; the slot belongs to the session staff member', async () => {
    const mali = await prisma.user.findUniqueOrThrow({ where: { email: 'staff.mali@slotbook.test' } });
    const anan = await prisma.user.findUniqueOrThrow({ where: { email: 'staff.anan@slotbook.test' } });
    const service = await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } });
    const agent = request.agent(app);
    await loginAs(agent, 'staff.anan@slotbook.test');

    // today+12 at 09:00 Bangkok: outside the seed range and the E2E dates.
    const date = addDays(bangkokDate(new Date()), 12);
    const res = await agent.post('/api/staff/slots')
      .query({ staffId: mali.id })
      .send({ serviceId: service.id, date, startTime: '09:00', staffId: mali.id, role: 'STAFF', userId: mali.id });

    expect(res.status).toBe(201);
    const row = await prisma.slot.findUniqueOrThrow({ where: { id: res.body.slot.id } });
    expect(row.staffId).toBe(anan.id);
  });

  it('API-08: customerId in the body is ignored; the booking belongs to the session customer', async () => {
    const mali = await prisma.user.findUniqueOrThrow({ where: { email: 'staff.mali@slotbook.test' } });
    const ploy = await prisma.user.findUniqueOrThrow({ where: { email: 'cust.ploy@slotbook.test' } });
    const ken = await prisma.user.findUniqueOrThrow({ where: { email: 'cust.ken@slotbook.test' } });
    const service = await prisma.service.findUniqueOrThrow({ where: { name: 'Academic advising' } });
    // today+12 at 10:00 Bangkok (real clock): outside the seed range and the E2E dates.
    const slot = await makeSlot(prisma, { staffId: mali.id, serviceId: service.id, date: addDays(bangkokDate(new Date()), 12), time: '10:00' });
    const agent = request.agent(app);
    await loginAs(agent, 'cust.ploy@slotbook.test');

    const res = await agent.post('/api/bookings')
      .query({ customerId: ken.id })
      .send({ slotId: slot.id, customerId: ken.id, userId: ken.id, role: 'CUSTOMER' });

    expect(res.status).toBe(201);
    const row = await prisma.booking.findUniqueOrThrow({ where: { reference: res.body.booking.reference } });
    expect(row.customerId).toBe(ploy.id);
    await prisma.booking.delete({ where: { id: row.id } }); // keep Ploy's real-clock bookings as seeded
    await prisma.slot.delete({ where: { id: slot.id } });
  });
});

describe('API-09 safe errors (F-02, NFR-06)', () => {
  for (const path of ['/api/__test__/throw', '/api/__test__/prisma-error']) {
    it(`API-09: ${path} → 500 INTERNAL_ERROR without stack trace, SQL or file path`, async () => {
      const res = await request(app).get(path);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
      expect(res.text).not.toMatch(/stack|SELECT|FROM|prisma|\/Users\/|\.ts\b|node_modules/i);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  }
});
