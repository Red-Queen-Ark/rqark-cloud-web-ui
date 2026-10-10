import { expect, type Page } from '@playwright/test';

/**
 * Vite delivers the stylesheet through JavaScript in dev, so a computed style
 * read right after `page.goto` can happen before any utility class is applied.
 * Waiting for a utility value proves the stylesheet is live; the playground
 * assertions below are not retrying, so they need that barrier.
 */
export async function waitForShellStyles(page: Page): Promise<void> {
  await expect(page.locator('#app-scroll')).toBeVisible();
  // h-12 on small screens, h-14 from sm upward.
  await expect(page.locator('header')).toHaveCSS('height', /^(48|56)px$/);
}

/** The same barrier for the pages that render outside the shell. */
export async function waitForAuthStyles(page: Page): Promise<void> {
  await expect(page.locator('#auth-panel')).toHaveCSS('display', 'flex');
}
