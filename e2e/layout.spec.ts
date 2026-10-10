import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession } from './support/mock-backend';
import { waitForAuthStyles, waitForShellStyles } from './support/styles';

test('the sidebar border matches the header border', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  const borders = await page.evaluate(() => {
    const sidebar = document.querySelector('.drawer-side > div');
    const header = document.querySelector('header');
    if (!sidebar || !header) {
      return null;
    }
    const sidebarStyle = getComputedStyle(sidebar);
    const headerStyle = getComputedStyle(header);
    return {
      sidebarColor: sidebarStyle.borderRightColor,
      sidebarWidth: sidebarStyle.borderRightWidth,
      sidebarHeight: sidebar.getBoundingClientRect().height,
      headerColor: headerStyle.borderBottomColor,
      headerWidth: headerStyle.borderBottomWidth,
      headerHeight: header.getBoundingClientRect().height,
    };
  });

  expect(borders).not.toBeNull();
  expect(borders?.sidebarWidth).toBe(borders?.headerWidth);
  expect(borders?.sidebarWidth).not.toBe('0px');
  expect(borders?.sidebarColor).toBe(borders?.headerColor);
  // Both bars sit on the same line, so their divider meets the page header.
  expect(borders?.headerHeight).toBeGreaterThanOrEqual(48);
});

test('the auth pages scroll inside the shell on a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('/en/register');

  await expect(page.locator('#register-confirm-password')).toBeVisible();
  await waitForAuthStyles(page);

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('#auth-panel');
    return {
      pageScrolls: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      panelScrolls: panel ? panel.scrollHeight > panel.clientHeight : false,
    };
  });

  expect(metrics.pageScrolls).toBe(false);
  expect(metrics.panelScrolls).toBe(true);

  await page.locator('#register-confirm-password').scrollIntoViewIfNeeded();
  await page.fill('#register-confirm-password', 'correct-horse-battery');
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('the settings page offers the appearance and language settings', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/settings');
  await waitForShellStyles(page);

  await expect(page.getByRole('heading', { level: 2, name: 'Appearance' })).toBeVisible();
  await expect(page.locator('#settings-theme')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Language' })).toBeVisible();
  await expect(page.locator('#settings-language')).toBeVisible();
  await expect(page.locator('#settings-language')).toHaveValue('en');

  // These are device preferences, so they apply without touching Save.
  await page.selectOption('#settings-theme', 'redqueen');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('redqueen-light');

  await page.locator('#settings-mode-dark').click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('redqueen-dark');
});

test('the system mode follows the device appearance', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/settings');
  await waitForShellStyles(page);

  await page.locator('#settings-mode-system').click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('base-light');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('base-dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('base-light');
});

test('a stored system mode survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/settings');
  await waitForShellStyles(page);

  await page.locator('#settings-mode-system').click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('base-dark');

  await page.reload();
  await waitForShellStyles(page);

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('base-dark');
});

test('the inline script resolves a stored system mode before the app starts', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    localStorage.setItem('themeStore', JSON.stringify({ family: 'gqs', mode: 'system' }));
  });
  // Blocking the entry module leaves the inline script in `<head>` as the only
  // thing that ran, which is exactly the state the first paint is based on.
  await page.route('**/src/main.ts*', (route) => route.abort());
  await page.goto('/en/settings');

  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('gqs-dark');
  expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe('dark');
});

test('the header switcher offers all three modes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  await page.locator('#theme-switcher').click();
  await expect(page.locator('#theme-mode-light')).toHaveText('Light');
  await expect(page.locator('#theme-mode-dark')).toHaveText('Dark');
  await expect(page.locator('#theme-mode-system')).toHaveText('System');

  await page.locator('#theme-mode-system').click();

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('base-dark');
  await expect(page.locator('#theme-mode-system')).toHaveClass(/active/);
});
