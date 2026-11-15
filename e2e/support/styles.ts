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

/**
 * Opens a daisyUI-free disclosure and leaves it open.
 *
 * Idempotent: an already open panel is left alone, so a spec can call it without
 * knowing whether an earlier step opened it.
 */
export async function openDisclosure(page: Page, id: string): Promise<void> {
  const disclosure = page.locator(`#${id}`);

  if (!(await disclosure.evaluate((el: HTMLDetailsElement) => el.open))) {
    await disclosure.locator('summary').click();
  }

  // The panel is only worth interacting with once it really is open.
  await expect(disclosure).toHaveAttribute('open', '');
}
