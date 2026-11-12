import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { sessionOptions } from '../../src/config/session.js';

const SECRET = 'x'.repeat(32);

describe('sessionOptions (F-01)', () => {
  it('UNIT-06: production cookie is Secure, HttpOnly, SameSite=Lax, 8 h rolling; development is not Secure', () => {
    const prod = sessionOptions('production', SECRET);
    expect(prod.cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 });
    expect(prod.rolling).toBe(true);
    expect(prod.name).toBe('sid');

    expect(sessionOptions('development', SECRET).cookie?.secure).toBe(false);
  });
});

describe('server startup (F-00, NFR-12)', () => {
  // Starts src/index.ts for real: it must exit 1 with a clear message before listening.
  const start = (secret: string | undefined) => spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', PORT: '0', SESSION_SECRET: secret },
    encoding: 'utf8',
    timeout: 20_000,
  });

  it('UNIT-07: in production the server refuses to start (exit 1, clear message) when SESSION_SECRET is missing, shorter than 32 characters or the .env.example placeholder', () => {
    for (const secret of [undefined, 'x'.repeat(31), 'change-me-at-least-32-characters-long']) {
      const run = start(secret);
      expect(run.status, String(secret)).toBe(1);
      expect(run.stderr).toMatch(/Refusing to start: SESSION_SECRET/);
      expect(run.stdout).not.toMatch(/listening|http:\/\//);
    }
  }, 30_000);
});

describe('graceful shutdown (F-00, NFR-12)', () => {
  it('UNIT-08: on SIGTERM (Cloud Run stop, docker stop) the running server closes and exits 0 instead of waiting for SIGKILL', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      env: { ...process.env, NODE_ENV: 'production', PORT: '0', SESSION_SECRET: 's'.repeat(32) },
    });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    await vi.waitFor(() => expect(out).toMatch(/listening/), { timeout: 20_000, interval: 100 });

    const started = Date.now();
    child.kill('SIGTERM');
    const code = await new Promise<number | null>((resolve) => child.on('exit', resolve));
    expect(code).toBe(0);
    expect(Date.now() - started).toBeLessThan(5_000);
  }, 30_000);
});
