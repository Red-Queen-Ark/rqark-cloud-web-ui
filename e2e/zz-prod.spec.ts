import { test } from '@playwright/test';
test('prod first frames', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.route('**/api/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:8098/en/login');
  for (const ms of [50, 150, 400, 900]) {
    await page.waitForTimeout(ms);
    const has = await page.locator('#boot-splash').count();
    const box = await page.locator('#boot-splash img').boundingBox().catch(() => null);
    console.log(`@@${ms}ms splash=${has} box=${JSON.stringify(box)}`);
  }
  await page.screenshot({ path: '/tmp/prod-login.png' });
  console.log('@@done', Date.now() - t0);
});
