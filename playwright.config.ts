import { defineConfig, devices } from '@playwright/test';

const production = process.env.POS_TEST_PRODUCTION !== 'false';
const port = process.env.POS_TEST_PORT || (production ? '3479' : '3477');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: production
      ? `node node_modules/next/dist/bin/next build --webpack && node node_modules/next/dist/bin/next start -p ${port}`
      : `node node_modules/next/dist/bin/next dev --webpack -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
