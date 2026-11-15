import { expect, test } from '@playwright/test';
import { boss, mockBackend, plain, seedSession } from './support/mock-backend';

test('the manage entry opens the console', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');

  await page.getByTestId('sidebar-manage-link').click();

  await expect(page).toHaveURL(/\/en\/manage$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  await expect(page.getByTestId('manage-sidebar-agents-link')).toBeVisible();
});

test('an ordinary account reaches the console but not the account pages', async ({ page }) => {
  await mockBackend(page, { session: plain });
  await seedSession(page);
  await page.goto('/en/manage/agents');

  await expect(page).toHaveURL(/\/en\/manage\/agents$/);
  await expect(page.getByTestId('manage-sidebar-agents-link')).toBeVisible();
  await expect(page.getByTestId('manage-sidebar-users-link')).toHaveCount(0);
  await expect(page.getByTestId('manage-sidebar-groups-link')).toHaveCount(0);
});

test('an ordinary account sent to an account page is turned away', async ({ page }) => {
  await mockBackend(page, { session: plain });
  await seedSession(page);
  await page.goto('/en/manage/users');

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByText('You do not have permission to perform this action.')).toBeVisible();
});
