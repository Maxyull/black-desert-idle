const { defineConfig } = require('@playwright/test');

const port = process.env.PLAYWRIGHT_PORT || '49213';
const baseURL = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
  timeout: 60_000,
  workers: 1,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `python3 -m http.server ${port}`,
    url: `${baseURL}/index.dev.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
