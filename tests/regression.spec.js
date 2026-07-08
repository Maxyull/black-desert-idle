const { test, expect } = require('@playwright/test');

test('runRegressionTests passes in the dev page', async ({ page }) => {
  const pageErrors = [];

  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  await page.goto('/index.dev.html', { waitUntil: 'load' });

  await expect
    .poll(
      () => page.evaluate(() => typeof window.runRegressionTests),
      { timeout: 10_000, message: 'window.runRegressionTests should be loaded by tests/tests.js' }
    )
    .toBe('function');

  const result = await page.evaluate(() => window.runRegressionTests());
  const failures = Array.isArray(result.failed) ? result.failed : [];
  const details = failures.map(failure => `${failure.name}: ${failure.detail}`).join('\n');

  expect(failures, details).toEqual([]);
  expect(result.passed).toBe(result.total);
  expect(pageErrors).toEqual([]);
});
