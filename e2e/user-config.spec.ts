import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockBackend } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

function configWrite(backend: MockBackend, method: string, key: string) {
  return backend.writes.filter((write) => write.method === method && write.path === `/user-config/${key}`).at(-1);
}

test('a theme stored on the account is applied on load', async ({ page }) => {
  await mockBackend(page, { session: { ...boss }, userConfig: { theme: { family: 'redqueen', mode: 'dark' } } });
  await seedSession(page);
  await page.goto('/en');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'redqueen-dark');
});

test('a language stored on the account is restored as a redirect', async ({ page }) => {
  await mockBackend(page, { session: { ...boss }, userConfig: { language: 'zh-tw' } });
  await seedSession(page);
  await page.goto('/en');

  await expect(page).toHaveURL(/\/zh-tw$/);
});

test('a value the account does not have yet is seeded from the device', async ({ page }) => {
  const backend = await mockBackend(page, { session: { ...boss } });
  await seedSession(page);
  await page.goto('/en/settings');
  await waitForShellStyles(page);

  await expect.poll(() => configWrite(backend, 'PUT', 'theme')?.body).toEqual({ value: { family: 'base', mode: 'system' } });
  await expect.poll(() => configWrite(backend, 'PUT', 'language')?.body).toEqual({ value: 'en' });
});

test('changing the theme stores it on the account', async ({ page }) => {
  const backend = await mockBackend(page, { session: { ...boss } });
  await seedSession(page);
  await page.goto('/en/settings');
  await waitForShellStyles(page);

  await expect.poll(() => configWrite(backend, 'PUT', 'theme')).toBeDefined();

  await page.selectOption('#settings-theme', 'redqueen');
  await page.locator('#settings-mode-dark').click();

  await expect.poll(() => configWrite(backend, 'PUT', 'theme')?.body).toEqual({ value: { family: 'redqueen', mode: 'dark' } });
});

test('changing the language stores it on the account', async ({ page }) => {
  const backend = await mockBackend(page, { session: { ...boss } });
  await seedSession(page);
  await page.goto('/en/settings');
  await waitForShellStyles(page);

  await expect.poll(() => configWrite(backend, 'PUT', 'language')).toBeDefined();

  await page.selectOption('#settings-language', 'zh-tw');

  await expect(page).toHaveURL(/\/zh-tw\/settings$/);
  await expect.poll(() => configWrite(backend, 'PUT', 'language')?.body).toEqual({ value: 'zh-tw' });
});
