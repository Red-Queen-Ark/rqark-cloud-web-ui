import { expect, test } from '@playwright/test';
import { mockBackend } from './support/mock-backend';

test('an unauthenticated visitor is redirected to the login page', async ({ page }) => {
  await page.goto('/en/users');

  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.locator('#login-username')).toBeVisible();
});

test('signing in lands on the dashboard and shows the account name', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/en/login');

  await page.fill('#login-username', 'boss');
  await page.fill('#login-password', 'correct-horse-battery');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByText('Welcome back, Boss!')).toBeVisible();
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
  await page.goto('/en/login');

  await page.getByRole('link', { name: 'Create one' }).click();
  await expect(page).toHaveURL(/\/en\/register$/);

  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en\/login$/);

  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);
});

test('the users page lists the accounts returned by the backend', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/en/login');
  await page.fill('#login-username', 'boss');
  await page.fill('#login-password', 'correct-horse-battery');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/en$/);

  await page.getByRole('list').getByRole('link', { name: 'Users' }).click();

  await expect(page).toHaveURL(/\/en\/users$/);
  await expect(page.getByRole('cell', { name: 'boss@example.com' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Superuser' })).toBeVisible();
});
