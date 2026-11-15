import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession } from './support/mock-backend';

const pages: { link: string; path: string; title: string }[] = [
  { link: 'manage-sidebar-manage-link', path: '/en/manage', title: 'Dashboard' },
  { link: 'manage-sidebar-agents-link', path: '/en/manage/agents', title: 'AI Agent' },
  { link: 'manage-sidebar-agentDefaults-link', path: '/en/manage/agent-defaults', title: 'Agent Defaults' },
  { link: 'manage-sidebar-providers-link', path: '/en/manage/providers', title: 'Providers' },
  { link: 'manage-sidebar-sessions-link', path: '/en/manage/sessions', title: 'Sessions' },
  { link: 'manage-sidebar-memory-link', path: '/en/manage/memory', title: 'Memory' },
  { link: 'manage-sidebar-agentState-link', path: '/en/manage/agent-state', title: 'Agent State' },
  { link: 'manage-sidebar-sops-link', path: '/en/manage/sops', title: 'SOPs' },
  { link: 'manage-sidebar-apiKeys-link', path: '/en/manage/api-keys', title: 'API keys' },
  { link: 'manage-sidebar-usage-link', path: '/en/manage/usage', title: 'Usage' },
  { link: 'manage-sidebar-users-link', path: '/en/manage/users', title: 'Users' },
  { link: 'manage-sidebar-groups-link', path: '/en/manage/groups', title: 'Groups' },
  { link: 'manage-sidebar-manageSettings-link', path: '/en/manage/settings', title: 'Settings' },
];

test('the console lists every ported page', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/manage');

  for (const { link } of pages) {
    await expect(page.getByTestId(link)).toBeVisible();
  }
});

for (const { link, path, title } of pages) {
  test(`the ${title} page opens from the console`, async ({ page }) => {
    await mockBackend(page, { session: boss });
    await seedSession(page);
    await page.goto('/en/manage');

    await page.getByTestId(link).click();

    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  });
}

test('the chat button leaves the console', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en/manage/agents');

  await page.getByTestId('sidebar-chat-link').click();

  await expect(page).toHaveURL(/\/en$/);
});
