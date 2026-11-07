import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp, errorHandler } from '../../src/app.js';
import { requireRole } from '../../src/middleware/requireRole.js';
import { loginAs } from '../helpers.js';

type Role = 'CUSTOMER' | 'STAFF';

// F-02 §2 role/permission matrix. Every Issue that adds an endpoint adds its row here (#4 staff, #5-#7 others).
export const PROTECTED_ROUTES: { method: 'get' | 'post'; path: string; roles: Role[] }[] = [
  { method: 'post', path: '/api/auth/logout', roles: ['CUSTOMER', 'STAFF'] },
  { method: 'get', path: '/api/auth/me', roles: ['CUSTOMER', 'STAFF'] },
  { method: 'get', path: '/api/services', roles: ['CUSTOMER', 'STAFF'] },
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
  // Slot part (staffId in the body is ignored) is added by Issue #4; booking part (customerId) by Issue #5.
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
