import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession } from '../support/mock-backend';

test('the single save button writes the profile and the password together', async ({ page }) => {
  const backend = await mockBackend(page, { session: { ...boss } });
  await seedSession(page);
  await page.goto('/en/manage/settings');

  await page.fill('#settings-display-name', 'Boss Renamed');
  await page.fill('#settings-current-password', 'correct-horse-battery');
  await page.fill('#settings-new-password', 'staple-correct-battery');
  await page.fill('#settings-confirm-password', 'staple-correct-battery');

  await page.locator('#settings-save-btn').click();

  await expect(page.getByText('Profile and password updated')).toBeVisible();
  expect(backend.requests).toContain('PATCH /users/me');
  expect(backend.requests).toContain('PUT /users/me/password');
  await expect(page.locator('#settings-current-password')).toHaveValue('');
  // The header reflects the renamed account without a reload.
  await expect(page.locator('header')).toContainText('Boss Renamed');
});

test('the save button leaves the password alone when the fields are empty', async ({ page }) => {
  const backend = await mockBackend(page, { session: { ...boss } });
  await seedSession(page);
  await page.goto('/en/manage/settings');

  await page.fill('#settings-email', 'boss@example.org');
  await page.locator('#settings-save-btn').click();

  await expect(page.getByText('Profile updated')).toBeVisible();
  expect(backend.requests).toContain('PATCH /users/me');
  expect(backend.requests).not.toContain('PUT /users/me/password');
});

test('a half filled password is rejected without calling the backend', async ({ page }) => {
  const backend = await mockBackend(page, { session: { ...boss } });
  await seedSession(page);
  await page.goto('/en/manage/settings');

  await page.fill('#settings-new-password', 'staple-correct-battery');
  await page.locator('#settings-save-btn').click();

  await expect(page.getByText('Please fill in every password field')).toBeVisible();
  expect(backend.requests).not.toContain('PATCH /users/me');
  expect(backend.requests).not.toContain('PUT /users/me/password');
});

test('a mismatched confirmation is rejected without calling the backend', async ({ page }) => {
  const backend = await mockBackend(page, { session: { ...boss } });
  await seedSession(page);
  await page.goto('/en/manage/settings');

  await page.fill('#settings-current-password', 'correct-horse-battery');
  await page.fill('#settings-new-password', 'staple-correct-battery');
  await page.fill('#settings-confirm-password', 'something-else');
  await page.locator('#settings-save-btn').click();

  await expect(page.getByText('The two passwords do not match')).toBeVisible();
  expect(backend.requests).not.toContain('PATCH /users/me');
  expect(backend.requests).not.toContain('PUT /users/me/password');
});
