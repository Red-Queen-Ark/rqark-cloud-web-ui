import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockBackend, type MockProject } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

const acme: MockProject = {
  id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  project_name: 'acme',
  project_path: 'acme',
  created_at: '2026-04-05T06:07:08Z',
};

const other: MockProject = {
  id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
  project_name: 'other',
  project_path: 'other',
  created_at: '2026-04-04T06:07:08Z',
};

function orderWrite(backend: MockBackend) {
  return backend.writes.filter((write) => write.path === '/user-config/project_order').at(-1);
}

test('dragging a project stores the new order on the account', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, projects: [acme, other] });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  await page.getByTestId('sidebar-projects-toggle').click();
  await expect(page.getByTestId('sidebar-projects').getByRole('button', { name: /acme/ })).toBeVisible();

  await page.getByTestId(`sidebar-project-row-${acme.id}`).dragTo(page.getByTestId(`sidebar-project-row-${other.id}`));

  await expect.poll(() => orderWrite(backend)?.body).toEqual({ value: { order: [other.id, acme.id] } });
  await expect(page.getByTestId(`sidebar-project-toggle-${other.id}`)).toContainText('other');
});

test('an order stored on the account is applied on load', async ({ page }) => {
  await mockBackend(page, { session: boss, projects: [acme, other], userConfig: { project_order: { order: [other.id, acme.id] } } });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  await page.getByTestId('sidebar-projects-toggle').click();

  await expect(page.getByTestId('sidebar-project-list').locator('[data-testid^="sidebar-project-toggle-"]')).toHaveText([/other/, /acme/]);
});
