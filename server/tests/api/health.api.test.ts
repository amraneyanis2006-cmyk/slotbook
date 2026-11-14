import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';

describe('GET /api/health (F-00)', () => {
  it('API-25: returns 200 { status: "ok", database: "up" } without a session', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('GET /api/ready (F-00, NFR-12)', () => {
  afterEach(() => vi.restoreAllMocks());
  it('API-26: 200 { status: "ready", database: "connected" } without a session; 503 { status: "not_ready" } when the database is unreachable', async () => {
    const app = createApp();
    const ok = await request(app).get('/api/ready');
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ status: 'ready', database: 'connected' });
    expect(ok.headers['set-cookie']).toBeUndefined();

    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const down = await request(app).get('/api/ready');
    expect(down.status).toBe(503);
    expect(down.body).toEqual({ status: 'not_ready' });
  });
});

describe('GET /api/version (F-00, NFR-12)', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('API-28: returns the running commit (APP_COMMIT) and Cloud Run revision (K_REVISION) without a session; "local" and null when unset', async () => {
    vi.stubEnv('APP_COMMIT', '0123456789abcdef0123456789abcdef01234567');
    vi.stubEnv('K_REVISION', 'slotbook-00002-abc');
    const set = await request(createApp()).get('/api/version');
    expect(set.status).toBe(200);
    expect(set.body).toEqual({ commit: '0123456789abcdef0123456789abcdef01234567', revision: 'slotbook-00002-abc' });
    expect(set.headers['set-cookie']).toBeUndefined();

    vi.stubEnv('APP_COMMIT', undefined);
    vi.stubEnv('K_REVISION', undefined);
    const unset = await request(createApp()).get('/api/version');
    expect(unset.status).toBe(200);
    expect(unset.body).toEqual({ commit: 'local', revision: null });
  });
});
