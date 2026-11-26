import { configDefaults, defineConfig } from 'vitest/config';

try { process.loadEnvFile('../.env'); } catch { /* CI provides real env vars */ }

export default defineConfig({
  test: {
    globalSetup: process.env.SLOTBOOK_PERF_URL ? [] : './tests/setup.ts', // the deployed check needs no local database
    fileParallelism: false,
    // PERF-01 (tests/perf) runs only through `npm run test:perf`, which sets SLOTBOOK_PERF=1; PERF-02's deployed part
    // (deployed.perf.test.ts) only through `npm run test:perf:deployed`, which also needs SLOTBOOK_PERF_URL.
    include: process.env.SLOTBOOK_PERF ? [process.env.SLOTBOOK_PERF_URL ? 'tests/perf/deployed.perf.test.ts' : 'tests/perf/perf.test.ts'] : ['tests/**/*.test.ts'],
    exclude: process.env.SLOTBOOK_PERF ? configDefaults.exclude : [...configDefaults.exclude, 'tests/perf/**'],
    testTimeout: process.env.SLOTBOOK_PERF ? 300_000 : 5_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? '',
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'test-secret',
    },
  },
});
