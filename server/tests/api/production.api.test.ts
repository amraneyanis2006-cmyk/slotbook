import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

// A fake client build, so the test does not depend on `npm run build`.
const dist = mkdtempSync(join(tmpdir(), 'slotbook-dist-'));
mkdirSync(join(dist, 'assets'));
writeFileSync(join(dist, 'index.html'), '<!doctype html><div id="root">SPA-INDEX</div>');
writeFileSync(join(dist, 'assets', 'app.js'), 'console.log("asset");');

afterEach(() => vi.unstubAllEnvs());

describe('production serving (F-00, NFR-12)', () => {
  it('API-27: in production Express serves CLIENT_DIST with an index.html fallback for non-/api GET routes, /api 404s stay JSON, and the Secure cookie is set behind the proxy', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'p'.repeat(32));
    vi.stubEnv('CLIENT_DIST', dist);
    const app = createApp();

    for (const path of ['/', '/login', '/bookings/42']) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(200);
      expect(res.text, path).toContain('SPA-INDEX');
    }
    expect((await request(app).get('/assets/app.js')).headers['content-type']).toMatch(/javascript/);

    for (const path of ['/api', '/api/nope']) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(404);
      expect(res.body, path).toEqual({ error: 'NOT_FOUND', message: 'Not found.' });
    }

    // Cloud Run terminates TLS: without trust proxy, express-session would drop the Secure cookie.
    const login = await request(app).post('/api/auth/login').set('X-Forwarded-Proto', 'https')
      .send({ email: 'cust.ploy@slotbook.test', password: process.env.SEED_PASSWORD });
    expect(login.status).toBe(200);
    expect(String(login.headers['set-cookie'])).toMatch(/^sid=.*; Secure/);
  });

  it('API-27: outside production the API does not serve the SPA (Vite does in development)', async () => {
    vi.stubEnv('CLIENT_DIST', dist);
    expect((await request(createApp()).get('/bookings/42')).status).toBe(404);
  });
});
