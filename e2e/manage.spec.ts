import { expect, test } from '@playwright/test';
import { boss, mockBackend, plain, seedSession } from './support/mock-backend';

test('a superuser reaches the manage page from the sidebar', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');

  await page.getByTestId('sidebar-manage-link').click();

  await expect(page).toHaveURL(/\/en\/manage$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  await expect(page.getByTestId('manage-sidebar-agents-link')).toBeVisible();
});

test('a plain user does not see the manage link', async ({ page }) => {
  await mockBackend(page, { session: plain });
  await seedSession(page);
  await page.goto('/en');

  await expect(page.getByTestId('sidebar-manage-link')).toHaveCount(0);
});

test('a plain user sent to the manage page is turned away', async ({ page }) => {
  await mockBackend(page, { session: plain });
  await seedSession(page);
  await page.goto('/en/manage');

  await expect(page).toHaveURL(/\/en$/);
});
