import { defineConfig, devices } from '@playwright/test';

// Runs against `vite --mode mock` (MSW with recorded real-API fixtures), so no backend is needed.
// PW_CHANNEL=chrome uses an installed Google Chrome instead of `npx playwright install chromium`.
const channel = process.env.PW_CHANNEL || undefined;
const PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev:mock -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 5'], channel, viewport: { width: 360, height: 740 } }, testMatch: /mobile\.spec/ },
  ],
});
