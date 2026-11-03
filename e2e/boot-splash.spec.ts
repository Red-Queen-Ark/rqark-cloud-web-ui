import { expect, test } from '@playwright/test';

/**
 * index.html paints the mark itself before any script runs, because iOS paints
 * its own launch image first and stretches it whenever none of the
 * `apple-touch-startup-image` media queries matches the device — always the
 * case in a resized window. The mark is inline, so it needs no request, and it
 * keeps its square aspect ratio.
 */

test('the mark is on screen from the first paint and then steps aside', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });

  await expect(page.locator('#boot-splash svg')).toBeVisible();
  await expect(page.locator('#boot-splash')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('#app')).toBeVisible();
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

    const box = await page.locator('#boot-splash svg').boundingBox();
    expect(box, `${size.width}x${size.height}`).not.toBeNull();
    // The mark is square: drawing it square is what keeps it undistorted, and
    // filling the window in one axis is exactly the stretch being fixed.
    expect((box?.width ?? 0) / (box?.height ?? 1), `${size.width}x${size.height}`).toBeCloseTo(1, 1);
    expect(box?.width ?? 0).toBeLessThanOrEqual(Math.min(size.width, size.height));
  }
});
