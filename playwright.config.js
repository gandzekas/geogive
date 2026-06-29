const { devices } = require('@playwright/test');

module.exports = {
  testDir: './tests',
  timeout: 30000,
  retries: 2,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 8080',
    port: 8080,
    timeout: 30000,
  },
};
