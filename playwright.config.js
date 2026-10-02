import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets several checkouts run the suite side by side.
const port = Number(process.env.E2E_PORT) || 4181;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    command: `npm run build:site && python3 -m http.server ${port} --bind 127.0.0.1 --directory dist`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
