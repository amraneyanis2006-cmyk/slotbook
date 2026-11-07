import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('GET /api/health (F-00)', () => {
  it('API-25: returns 200 { status: "ok", database: "up" } without a session', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
