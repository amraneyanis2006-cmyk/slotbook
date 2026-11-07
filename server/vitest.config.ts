import { defineConfig } from 'vitest/config';

try { process.loadEnvFile('../.env'); } catch { /* CI provides real env vars */ }

export default defineConfig({
  test: {
    globalSetup: './tests/setup.ts',
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? '',
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'test-secret',
    },
  },
});
