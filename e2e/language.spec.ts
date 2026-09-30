import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession } from './support/mock-backend';

async function openLanguageMenu(page: Page) {
  const switcher = page.locator('#language-switcher');
  await switcher.locator('#language-switcher-btn').click();
  return switcher;
}

test('the language menu lists every locale and marks the active one', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');

  const switcher = await openLanguageMenu(page);

  await expect(switcher.getByRole('button', { name: 'English' })).toHaveClass(/menu-active/);
  await expect(switcher.getByRole('button', { name: '繁體中文' })).toBeVisible();
  await expect(switcher.getByRole('button', { name: '简体中文' })).toBeVisible();
});

test('picking a language translates the shell and the URL', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');

  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  const switcher = await openLanguageMenu(page);
  await switcher.getByRole('button', { name: '繁體中文' }).click();

  await expect(page).toHaveURL(/\/zh-tw$/);
  await expect(page.getByRole('heading', { level: 1, name: '儀表板' })).toBeVisible();
  await expect(page.getByRole('list').getByRole('link', { name: '用戶管理' })).toBeVisible();

  const switcherAfter = await openLanguageMenu(page);
  await expect(switcherAfter.getByRole('button', { name: '繁體中文' })).toHaveClass(/menu-active/);

  await switcherAfter.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
});

test('the chosen language survives navigation and a reload', async ({ page }) => {
  await mockBackend(page, { session: boss, groups: [{ id: 'group-1', name: 'engineering', created_at: '2026-04-05T06:07:08Z', memberIds: [] }] });
  await seedSession(page);
  await page.goto('/en');

  const switcher = await openLanguageMenu(page);
  await switcher.getByRole('button', { name: '简体中文' }).click();
  await expect(page).toHaveURL(/\/zh-cn$/);

  await page.getByRole('list').getByRole('link', { name: '用户管理' }).click();
  await expect(page).toHaveURL(/\/zh-cn\/users$/);
  await expect(page.getByRole('heading', { level: 1, name: '用户管理' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: '用户管理' })).toBeVisible();
});

test('the language menu closes after a language is picked', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');

  const switcher = await openLanguageMenu(page);
  await expect(switcher.locator('ul')).toBeVisible();
  await switcher.getByRole('button', { name: 'English' }).click();

  // daisyUI hides a closed dropdown's content, so it is out of the a11y tree.
  await expect(switcher.getByRole('button', { name: '繁體中文' })).toBeHidden();
});

test('the language can be changed from the settings page', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/settings');

  await expect(page.getByRole('heading', { level: 2, name: 'Language' })).toBeVisible();

  // Language is a device preference, so it applies on change.
  await page.selectOption('#settings-language', 'zh-tw');

  await expect(page).toHaveURL(/\/zh-tw\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: '設定' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '語言' })).toBeVisible();
  await expect(page.locator('#settings-language')).toHaveValue('zh-tw');
});

test('the settings language select follows the header switcher', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/settings');

  const switcher = await openLanguageMenu(page);
  await switcher.getByRole('button', { name: '简体中文' }).click();
  await expect(page).toHaveURL(/\/zh-cn\/settings$/);

  await expect(page.locator('#settings-language')).toHaveValue('zh-cn');
});

test('switching language keeps the query string', async ({ page }) => {
  await page.goto('/en/reset-password?token=reset-token-value');

  const switcher = await openLanguageMenu(page);
  await switcher.getByRole('button', { name: '繁體中文' }).click();

  await expect(page).toHaveURL(/\/zh-tw\/reset-password\?token=reset-token-value$/);
  await expect(page.locator('#reset-password')).toBeVisible();
});
