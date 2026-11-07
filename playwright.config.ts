import { defineConfig } from '@playwright/test';
import { VIEWPORTS } from './e2e/viewports';

try { process.loadEnvFile('.env'); } catch { /* CI provides real env vars */ }

// The E2E API runs against the TEST database (reset + seeded by e2e/global-setup.ts).
const apiEnv = { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST ?? '', NODE_ENV: 'test', PORT: '3000' } as Record<string, string>;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  use: { baseURL: 'http://localhost:5173', viewport: VIEWPORTS.desktop, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npx tsx src/index.ts', cwd: 'server', env: apiEnv, url: 'http://localhost:3000/api/health', reuseExistingServer: false },
    { command: 'npm run dev', cwd: 'client', url: 'http://localhost:5173', reuseExistingServer: false },
  ],
});
