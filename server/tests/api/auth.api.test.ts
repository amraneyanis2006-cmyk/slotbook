import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loginAs } from '../helpers.js';

const app = createApp();
const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());

const BAD_LOGIN = { error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' };

describe('POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me (F-01)', () => {
  it('API-01: valid credentials (also upper-case e-mail) return the user without secrets and an HttpOnly SameSite=Lax cookie', async () => {
    for (const email of ['cust.ploy@slotbook.test', 'CUST.Ploy@SlotBook.TEST']) {
      const res = await request(app).post('/api/auth/login').send({ email, password: process.env.SEED_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: { id: expect.any(Number), name: 'Ploy Chai', email: 'cust.ploy@slotbook.test', role: 'CUSTOMER' } });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|isActive|\$2[aby]\$/);
      const cookie = res.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toMatch(/^sid=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
    }
  });

  it('API-02: wrong password and unknown e-mail both return 401 INVALID_CREDENTIALS with the same message; no session follows', async () => {
    const agent = request.agent(app);
    const wrong = await agent.post('/api/auth/login').send({ email: 'cust.ploy@slotbook.test', password: 'not-the-password' });
    const unknown = await agent.post('/api/auth/login').send({ email: 'nobody@slotbook.test', password: 'whatever' });

    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(BAD_LOGIN);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(BAD_LOGIN);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('API-03: an inactive account cannot log in; a session of a user deactivated later gets 401 UNAUTHENTICATED', async () => {
    const inactive = await request(app).post('/api/auth/login').send({ email: 'cust.old@slotbook.test', password: process.env.SEED_PASSWORD });
    expect(inactive.status).toBe(401);
    expect(inactive.body).toEqual(BAD_LOGIN);

    const agent = request.agent(app);
    expect((await loginAs(agent, 'cust.nina@slotbook.test')).status).toBe(200);
    await prisma.user.update({ where: { email: 'cust.nina@slotbook.test' }, data: { isActive: false } });
    try {
      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(401);
      expect(me.body.error).toBe('UNAUTHENTICATED');
    } finally {
      await prisma.user.update({ where: { email: 'cust.nina@slotbook.test' }, data: { isActive: true } });
    }
    // The rejected session was destroyed: it stays invalid after reactivation.
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('API-04: /me returns the current Staff user; anonymous gets 401 UNAUTHENTICATED', async () => {
    const agent = request.agent(app);
    await loginAs(agent, 'staff.anan@slotbook.test');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ user: { id: expect.any(Number), name: 'Anan Wong', email: 'staff.anan@slotbook.test', role: 'STAFF' } });

    const anon = await request(app).get('/api/auth/me');
    expect(anon.status).toBe(401);
    expect(anon.body).toEqual({ error: 'UNAUTHENTICATED', message: 'Please log in.' });
  });

  it('API-05: after logout (204) the saved cookie is rejected on /me and on a protected endpoint', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'cust.ploy@slotbook.test', password: process.env.SEED_PASSWORD });
    const cookie = login.headers['set-cookie']![0].split(';')[0];
    expect((await request(app).get('/api/services').set('Cookie', cookie)).status).toBe(200);

    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(204);

    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect((await request(app).get('/api/services').set('Cookie', cookie)).status).toBe(401);
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(401);
  });
});
