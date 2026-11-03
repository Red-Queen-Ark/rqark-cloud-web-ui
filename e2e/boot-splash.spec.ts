import { expect, test } from '@playwright/test';

/**
 * index.html paints a splash of its own before any script runs, because iOS
 * paints its launch image first and stretches it whenever none of the
 * `apple-touch-startup-image` media queries matches the device — always the
 * case in a resized window. The splash the app draws keeps the mark's aspect
 * ratio and matches the size the launch artwork uses, so the hand-off is
 * invisible.
 */

test('the boot splash covers the first paint and then steps aside', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#boot-splash')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('#app')).toBeVisible();

  // Nothing is left behind that could swallow a tap.
  expect(await page.locator('#boot-splash').count()).toBe(0);
});

test('the mark keeps its shape in a landscape, portrait or resized window', async ({ page }) => {
  for (const size of [
    { width: 1180, height: 820 },
    { width: 820, height: 1180 },
    { width: 700, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    // Without the app the splash is the only thing on screen, so it can be
    // measured instead of racing the dismissal.
    await page.route('**/src/main.ts*', (route) => route.abort());
    await page.goto('/');

    const box = await page.locator('#boot-splash img').boundingBox();
    expect(box, `${size.width}x${size.height}`).not.toBeNull();
    // logo.svg is square: drawing it square is what keeps the mark undistorted,
    // and one axis filling the window is exactly the stretch being fixed.
    expect((box?.width ?? 0) / (box?.height ?? 1), `${size.width}x${size.height}`).toBeCloseTo(1, 1);
    expect(box?.width ?? 0).toBeLessThanOrEqual(Math.min(size.width, size.height));
  }
});
