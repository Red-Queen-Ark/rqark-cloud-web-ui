import { expect, test } from '@playwright/test';

/**
 * index.html paints the mark itself before any script runs, to cover the gap
 * iOS leaves between its own launch image and the first frame the app paints.
 * It exists for installed iOS apps only: a browser tab has no launch image and
 * no gap, so it must not show the splash at all.
 */

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/** Makes the page believe it is an installed iOS app. */
async function asInstalledIOS(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
    Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
  });
}

test('a browser tab never shows the splash', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });

  await expect(page.locator('#boot-splash')).toBeHidden();
});

test('an installed iOS app shows the mark from the first paint, then steps aside', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await asInstalledIOS(page);
  await page.goto('/', { waitUntil: 'commit' });

  await expect(page.locator('#boot-splash svg')).toBeVisible();
  await expect(page.locator('#boot-splash')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('#app')).toBeVisible();
  await context.close();
});

test('the mark keeps its shape in a landscape, portrait or resized window', async ({ browser }) => {
  for (const size of [
    { width: 1180, height: 820 },
    { width: 820, height: 1180 },
    { width: 700, height: 1000 },
  ]) {
    const context = await browser.newContext({ userAgent: IPHONE_UA, viewport: size });
    const page = await context.newPage();
    await asInstalledIOS(page);
    // Without the app the splash is the only thing on screen, so it can be
    // measured instead of racing the dismissal.
    await page.route('**/src/main.ts*', (route) => route.abort());
    await page.goto('/');

    const box = await page.locator('#boot-splash svg').boundingBox();
    expect(box, `${size.width}x${size.height}`).not.toBeNull();
    // The mark is square: drawing it square is what keeps it undistorted, and
    // filling the window in one axis is exactly the stretch being fixed.
    expect((box?.width ?? 0) / (box?.height ?? 1), `${size.width}x${size.height}`).toBeCloseTo(1, 1);
    // And it is drawn at the size the launch image uses, so a device whose
    // launch image matched hands over without the mark moving.
    expect(box?.width ?? 0, `${size.width}x${size.height}`).toBeCloseTo(Math.min(size.width, size.height) * 0.62, -1);
    await context.close();
  }
});
