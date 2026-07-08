const { test, expect } = require('@playwright/test');

test('production page loads the minified bundle', async ({ page }) => {
  const pageErrors = [];

  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  await page.goto('/index.html', { waitUntil: 'load' });

  await expect(page.locator('script[src^="build/source.min.js"]')).toHaveCount(1);
  await expect
    .poll(
      () => page.evaluate(() => ({
        aiMode: typeof window.aiMode,
        renderAiModeBtn: typeof window.renderAiModeBtn,
        setAiCombatMode: typeof window.setAiCombatMode,
        runRegressionTests: typeof window.runRegressionTests,
      })),
      { timeout: 10_000, message: 'production globals should survive minification' }
    )
    .toEqual({
      aiMode: 'function',
      renderAiModeBtn: 'function',
      setAiCombatMode: 'function',
      runRegressionTests: 'undefined',
    });

  expect(pageErrors).toEqual([]);
});
