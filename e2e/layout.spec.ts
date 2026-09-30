import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockUser } from './support/mock-backend';
import { waitForAuthStyles, waitForShellStyles } from './support/styles';

const adminPages = ['/en', '/en/users', '/en/groups', '/en/settings'];
const viewports = [
  { width: 390, height: 844, label: 'mobile' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1280, height: 800, label: 'desktop' },
];

/** Enough rows to make the content taller than the viewport. */
function manyUsers(count: number): MockUser[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `user-${index}`,
    username: `user${index}`,
    email: `user${index}@example.com`,
    display_name: `User ${index}`,
    is_active: index % 3 !== 0,
    is_staff: index % 5 === 0,
    is_superuser: false,
    created_at: '2026-04-05T06:07:08Z',
  }));
}

for (const viewport of viewports) {
  test(`no horizontal overflow on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockBackend(page, {
      session: boss,
      groups: [{ id: 'group-1', name: 'engineering', created_at: '2026-04-05T06:07:08Z', memberIds: [] }],
    });
    await seedSession(page);

    for (const path of adminPages) {
      await page.goto(path);
      await waitForShellStyles(page);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows at ${viewport.width}px`).toBeLessThanOrEqual(0);
    }
  });
}

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

test('the app shell scrolls internally instead of the page', async ({ page }) => {
  // A short viewport so the ten rendered rows cannot fit: the content has to
  // scroll inside the shell rather than moving the page.
  await page.setViewportSize({ width: 1280, height: 500 });
  await mockBackend(page, { session: boss, users: manyUsers(40) });
  await seedSession(page);
  await page.goto('/en/users');

  await expect(page.getByRole('cell', { name: 'user0@example.com' })).toBeVisible();
  await waitForShellStyles(page);

  const metrics = await page.evaluate(() => {
    const scroll = document.querySelector('#app-scroll');
    return {
      pageScrolls: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      innerScrolls: scroll ? scroll.scrollHeight > scroll.clientHeight : false,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });

  expect(metrics.bodyOverflow).toBe('hidden');
  expect(metrics.pageScrolls).toBe(false);
  expect(metrics.innerScrolls).toBe(true);
});

test('the shell uses the flat reference surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockBackend(page, { session: boss, users: manyUsers(3) });
  await seedSession(page);
  await page.goto('/en/users');
  await waitForShellStyles(page);

  const surfaces = await page.evaluate(() => {
    const header = document.querySelector('header');
    const sidebar = document.querySelector('.drawer-side > div');
    const surface = document.querySelector('#app-scroll .rounded-box');
    const read = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const surfaceStyle = read(surface);
    return {
      font: getComputedStyle(document.body).fontFamily,
      headerHeight: header?.getBoundingClientRect().height,
      sidebarWidth: sidebar?.getBoundingClientRect().width,
      surfaceBorderWidth: surfaceStyle?.borderTopWidth,
      surfaceShadow: surfaceStyle?.boxShadow,
    };
  });

  expect(surfaces.font).toContain('Plus Jakarta Sans');
  expect(surfaces.headerHeight).toBe(56);
  expect(surfaces.sidebarWidth).toBe(288);
  // Flat surfaces: a hairline border instead of a drop shadow.
  expect(surfaces.surfaceBorderWidth).toBe('1px');
  expect(surfaces.surfaceShadow).toBe('none');
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

test('sidebar rows fill the panel width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockBackend(page, { session: boss, groups: [{ id: 'group-1', name: 'engineering', created_at: '2026-04-05T06:07:08Z', memberIds: [] }] });
  await seedSession(page);

  // The Chinese labels are the longest, so they are the worst case for a
  // list that sizes itself to its content.
  for (const path of ['/en', '/zh-cn']) {
    await page.goto(path);
    await expect(page.locator('.drawer-side ul > li > a').first()).toBeVisible();
    await waitForShellStyles(page);

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector('.drawer-side > div');
      const links = Array.from(document.querySelectorAll('.drawer-side ul > li > a'));
      const logout = document.querySelector('.drawer-side > div > div:last-child > button');
      return {
        panelWidth: panel?.getBoundingClientRect().width ?? 0,
        linkWidths: links.map((el) => Math.round(el.getBoundingClientRect().width)),
        logoutWidth: logout ? Math.round(logout.getBoundingClientRect().width) : 0,
      };
    });

    // Every row is as wide as the footer action, and together they span the
    // panel instead of hugging their labels.
    expect(new Set(metrics.linkWidths).size, `${path}: rows differ in width`).toBe(1);
    expect(metrics.linkWidths[0], `${path}: row does not match the footer action`).toBe(metrics.logoutWidth);
    expect(metrics.linkWidths[0], `${path}: row leaves a gutter`).toBeGreaterThan(metrics.panelWidth * 0.9);
  }
});

test('the sidebar marks the page the user is on', async ({ page }) => {
  await mockBackend(page, { session: boss, groups: [{ id: 'group-1', name: 'engineering', created_at: '2026-04-05T06:07:08Z', memberIds: [] }] });
  await seedSession(page);
  await page.goto('/en/users');
  await waitForShellStyles(page);

  const rows = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.drawer-side ul > li > a')).map((el) => ({
      text: el.textContent?.trim() ?? '',
      background: getComputedStyle(el).backgroundColor,
    })),
  );

  const active = rows.filter((row) => row.text === 'Users');
  const rest = rows.filter((row) => row.text !== 'Users');

  expect(active).toHaveLength(1);
  expect(rest.length).toBeGreaterThan(0);
  // daisyUI only paints .menu-active, so the marker must not be transparent.
  expect(active[0].background).not.toBe('rgba(0, 0, 0, 0)');
  for (const row of rest) {
    expect(row.background).toBe('rgba(0, 0, 0, 0)');
  }
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

test('the settings page has exactly one save button', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/settings');
  await waitForShellStyles(page);

  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(1);
  await expect(page.locator('#settings-save-btn')).toBeVisible();
});

test('the navigation drawer opens and closes on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  const drawer = page.locator('input#main-drawer');
  await expect(drawer).not.toBeChecked();

  await page.getByLabel('Open navigation').click();
  await expect(drawer).toBeChecked();

  // Navigating from the open drawer has to dismiss it, otherwise the overlay
  // would cover the page the user asked for.
  await page.locator('.drawer-side ul').getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/en\/settings$/);
  await expect(drawer).not.toBeChecked();
});
