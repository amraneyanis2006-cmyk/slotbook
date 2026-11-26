import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// PERF-02 (NFR-11, AC-86), deployed part: 30 sequential calls of search (14 days) and available (one day) against the
// Cloud Run URL, network included. Read-only on purpose: no booking is created in production.
// Run: SLOTBOOK_PERF_URL=https://… npm run test:perf:deployed --prefix server
// The demo password is read at run time from SLOTBOOK_PW_FILE (default ~/.slotbook_pw, chmod 600) and never printed.
const RUNS = 30;
const LIMIT_MS = 500;
const base = process.env.SLOTBOOK_PERF_URL ?? '';
const email = process.env.SLOTBOOK_PERF_EMAIL ?? 'cust.ploy@slotbook.test';

const bangkokDate = (days: number) => new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
const p95 = (ms: number[]) => [...ms].sort((a, b) => a - b)[Math.ceil(0.95 * ms.length) - 1];

describe('NFR-11 deployed latency (F-18)', () => {
  it('PERF-02: deployed p95 of search (14 days) and available (one day) over 30 calls each is recorded and below 500 ms', async () => {
    expect(base, 'set SLOTBOOK_PERF_URL to the Cloud Run URL').toMatch(/^https:\/\//);
    const password = readFileSync(process.env.SLOTBOOK_PW_FILE ?? `${homedir()}/.slotbook_pw`, 'utf8').trim();
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    expect(login.status).toBe(200);
    const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
    const version = await (await fetch(`${base}/api/version`)).json() as { commit?: string; revision?: string };

    const lines: string[] = [];
    for (const [label, path] of [
      ['GET /api/slots/search (14 days)', `/api/slots/search?from=${bangkokDate(1)}&to=${bangkokDate(14)}`],
      ['GET /api/slots/available (one day)', `/api/slots/available?date=${bangkokDate(1)}`],
    ]) {
      const ms: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        const t0 = performance.now();
        const res = await fetch(`${base}${path}`, { headers: { cookie } });
        await res.arrayBuffer();
        ms.push(performance.now() - t0);
        expect(res.status).toBe(200);
      }
      const sorted = [...ms].sort((a, b) => a - b);
      lines.push(`${label.padEnd(36)} n=${RUNS} min=${sorted[0].toFixed(0)} median=${sorted[RUNS / 2].toFixed(0)} p95=${p95(ms).toFixed(0)} max=${sorted.at(-1)!.toFixed(0)} ms`);
      expect(p95(ms)).toBeLessThan(LIMIT_MS);
    }
    await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie } });

    const dir = fileURLToPath(new URL('../../../artifacts/sprint-3/perf/', import.meta.url));
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString();
    writeFileSync(`${dir}perf-02-deployed-${stamp.slice(0, 10)}.txt`, [
      `PERF-02 deployed (NFR-11, AC-86) — ${stamp}, ${new URL(base).host}, commit ${version.commit ?? '?'}, revision ${version.revision ?? '?'}, node ${process.version}`,
      `Sequential calls as ${email} from the tester's machine (network included). Threshold: p95 < ${LIMIT_MS} ms.`,
      ...lines, '',
    ].join('\n'));
  });
});
