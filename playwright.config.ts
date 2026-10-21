import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const base = (process.env.BASE_URL ?? 'https://be-dashboard-rpz.unictive.net/api/v1').replace(/\/?$/, '/');

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: base, extraHTTPHeaders: { Accept: 'application/json' } },
});
