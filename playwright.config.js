import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  use: { baseURL: process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4187', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { baseURL: process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4187', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { baseURL: process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4188', ...devices['Pixel 7'] } },
  ],
  webServer: process.env.TEST_BASE_URL ? undefined : [4187,4188].map(port => ({ command: 'node tests/start-server.mjs', env: { TEST_PORT: String(port) }, gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 }, url: `http://127.0.0.1:${port}`, reuseExistingServer: false })),
});
