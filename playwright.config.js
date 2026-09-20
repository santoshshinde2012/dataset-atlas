import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4181',
  },
  webServer: {
    command: 'npm run build:site && python3 -m http.server 4181 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:4181',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
