import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import request, { type Agent } from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { addDays, bangkokDate } from '../../src/utils/time.js';
import { loginAs } from '../helpers.js';
import { seedTimes10 } from './seedTimes10.js';

// NFR-11 / AC-66: run with `npm run test:perf` (not part of `npm test`). p95 of 100 sequential calls < 500 ms.
const RUNS = 100;
const LIMIT_MS = 500;
const app = createApp();
const prisma = new PrismaClient();
const lines: string[] = [];
let customer: Agent;
let counts = { slots: 0, bookings: 0 };

const stats = (ms: number[]) => {
  const sorted = [...ms].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  return { min: sorted[0], median: pick(0.5), p95: pick(0.95), max: sorted.at(-1)! };
};
async function timed(label: string, call: (i: number) => Promise<request.Response>, expected: number) {
  const ms: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const res = await call(i);
    ms.push(performance.now() - t0);
    expect(res.status).toBe(expected);
  }
  const s = stats(ms);
  lines.push(`${label.padEnd(44)} n=${RUNS} min=${s.min.toFixed(1)} median=${s.median.toFixed(1)} p95=${s.p95.toFixed(1)} max=${s.max.toFixed(1)} ms`);
  return s;
}

beforeAll(async () => {
  counts = await seedTimes10(prisma);
  customer = request.agent(app);
  await loginAs(customer, 'cust.nina@slotbook.test');
}, 120_000);
afterAll(async () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { return 'unknown'; } })();
  const dir = `${root}artifacts/sprint-2/perf`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/perf-${commit}.txt`, [
    `PERF-01 (NFR-11, AC-66) — commit ${commit}, ${new Date().toISOString()}, node ${process.version}`,
    `Data: seed ×10 in the _test database (${counts.slots} slots, ${counts.bookings} bookings); sequential calls through Supertest (no network).`,
    `Threshold: p95 < ${LIMIT_MS} ms per endpoint.`,
    ...lines, '',
  ].join('\n'));
  await prisma.$disconnect();
});

describe('NFR-11 performance smoke test (F-12)', () => {
  it('PERF-01: p95 < 500 ms for search (14 days), available (one day) and book (distinct slots) with the seed data ×10', async () => {
    const today = bangkokDate(new Date());
    expect(counts.slots).toBeGreaterThanOrEqual(500);

    const search = await timed('GET /api/slots/search (14 days)', () =>
      customer.get('/api/slots/search').query({ from: today, to: addDays(today, 13) }), 200);
    const available = await timed('GET /api/slots/available (one day)', (i) =>
      customer.get('/api/slots/available').query({ date: addDays(today, 2 + (i % 6)) }), 200);

    // 100 distinct bookable slots ≥ 24 h ahead; each booking is cancelled (untimed) so BR-03 never blocks the next one.
    const free = (await customer.get('/api/slots/search').query({ from: addDays(today, 2), to: addDays(today, 7) })).body.slots as { id: number }[];
    expect(free.length).toBeGreaterThanOrEqual(RUNS);
    const book = await timed('POST /api/bookings (distinct slots)', async (i) => {
      const res = await customer.post('/api/bookings').send({ slotId: free[i].id });
      if (res.status === 201) await customer.post(`/api/bookings/${res.body.booking.reference}/cancel`).send({});
      return res;
    }, 201);

    for (const s of [search, available, book]) expect(s.p95).toBeLessThan(LIMIT_MS);
  }, 300_000);
});
