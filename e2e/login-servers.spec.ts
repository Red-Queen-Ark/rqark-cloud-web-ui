import { expect, test } from '@playwright/test';
import { mockBackend } from './support/mock-backend';

test('keeps the server settings out of the login page on the web', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/en/login');

  await expect(page.locator('#login-username')).toBeVisible();
  await expect(page.locator('#login-server-settings')).toHaveCount(0);
  await expect(page.locator('#settings-api-base')).toHaveCount(0);
});
