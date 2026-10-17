import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockTask } from './support/mock-backend';

const task: MockTask = {
  id: 'task-1',
  name: 'Morning brief',
  prompt: 'Summarise my inbox.',
  agent_name: 'Angel Holiday',
  provider_name: 'gpt-5',
  timezone: 'Asia/Hong_Kong',
  enabled: true,
  schedule_kind: 'cron',
  run_at: null,
  every_seconds: null,
  cron_expr: '0 9 * * *',
  next_run_at: '2026-10-18T01:00:00Z',
  created_at: '2026-10-01T02:03:04Z',
  updated_at: '2026-10-02T03:04:05Z',
};

test('the task row orders its actions the way the rest of the app does', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    tasks: [task],
    agents: [{ id: 'agent-1', name: 'Angel Holiday', description: '', created_at: '2026-10-01T00:00:00Z' }],
    providers: [{ id: 'provider-1', name: 'gpt-5', model_name: 'gpt-5', created_at: '2026-10-01T00:00:00Z' }],
  });
  await seedSession(page);

  await page.goto('/en/tasks');

  // Read first, then the two that change or remove it.
  await expect(page.getByTestId('task-row-task-1').getByRole('link', { name: 'View' })).toBeVisible();
  await expect(page.getByTestId('task-row-task-1').getByRole('button')).toHaveText(['Edit', 'Delete']);
});
