import { expect, test } from '@playwright/test';
import { mockBackend } from './support/mock-backend';

test('an unauthenticated visitor is redirected to the login page', async ({ page }) => {
  await page.goto('/en/settings');

  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.locator('#login-username')).toBeVisible();
});

test('wrong credentials keep the visitor on the login page', async ({ page }) => {
  await mockBackend(page, { loginStatus: 401 });
  await page.goto('/en/login');

  await page.fill('#login-username', 'boss');
  await page.fill('#login-password', 'wrong-password');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByText('Invalid credentials')).toBeVisible();
});

test('the login page links to register and password recovery', async ({ page }) => {
  await mockBackend(page, { allowSelfRegistration: true });
  await page.goto('/en/login');

  await page.getByRole('link', { name: 'Create one' }).click();
  await expect(page).toHaveURL(/\/en\/register$/);

  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en\/login$/);

  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);
});
