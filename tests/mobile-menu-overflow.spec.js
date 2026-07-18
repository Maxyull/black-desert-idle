const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 844 } });

test('mobile header menus scroll internally without widening the page', async ({ page }) => {
  await page.goto('/index.dev.html', { waitUntil: 'load' });

  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const topbarRight = document.querySelector('.topbar-right');
    const activityTabs = document.getElementById('activityTabs');

    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      topbarClientWidth: topbarRight.clientWidth,
      topbarScrollWidth: topbarRight.scrollWidth,
      activitiesClientWidth: activityTabs.clientWidth,
      activitiesScrollWidth: activityTabs.scrollWidth,
    };
  });

  expect(layout.documentWidth).toBe(layout.viewportWidth);
  expect(layout.bodyWidth).toBe(layout.viewportWidth);
  expect(layout.topbarScrollWidth).toBeGreaterThan(layout.topbarClientWidth);
  expect(layout.activitiesScrollWidth).toBeGreaterThan(layout.activitiesClientWidth);
});
