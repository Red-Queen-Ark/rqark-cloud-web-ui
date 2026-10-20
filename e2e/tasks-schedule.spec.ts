import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockTask } from './support/mock-backend';
import { openRowActions } from './support/row-actions';

const weekdayTask: MockTask = {
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
  cron_expr: '30 9 * * 1-5',
  next_run_at: '2026-10-19T01:30:00Z',
  created_at: '2026-10-01T02:03:04Z',
  updated_at: '2026-10-02T03:04:05Z',
};

async function openTasks(page: Page, tasks: MockTask[] = []) {
  const backend = await mockBackend(page, {
    session: boss,
    tasks,
    agents: [{ id: 'agent-1', name: 'Angel Holiday', description: '', created_at: '2026-10-01T00:00:00Z' }],
    providers: [{ id: 'provider-1', name: '', model_name: 'gpt-5', created_at: '2026-10-01T00:00:00Z' }],
  });
  await seedSession(page);
  await page.goto('/en/tasks');
  return backend;
}

test('renders the next run in the shared timestamp shape', async ({ page }) => {
  await openTasks(page, [weekdayTask]);

  await expect(page.getByTestId('task-row-task-1')).toContainText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
});

test('lists the schedule in words and offers a provider with no name of its own', async ({ page }) => {
  await openTasks(page, [weekdayTask]);

  await expect(page.getByTestId('task-row-task-1')).toContainText('Weekdays at 09:30');
  await expect(page.getByTestId('task-row-task-1')).toContainText('gpt-5');

  await page.locator('#task-page-create-btn').click();
  await expect(page.locator('#task-provider option')).toHaveCount(2);
  await expect(page.locator('#task-provider')).toContainText('gpt-5');
});

test('offers each repeat pattern without asking for a cron expression', async ({ page }) => {
  await openTasks(page);

  await page.locator('#task-page-create-btn').click();
  await page.locator('#task-kind-cron').click();

  const repeat = page.locator('#task-repeat');
  await expect(repeat.locator('option')).toHaveText(['Every day', 'Weekdays (Mon–Fri)', 'Every week', 'Every month', 'Advanced (cron expression)']);

  await repeat.selectOption('weekly');
  await expect(page.locator('#task-weekday')).toBeVisible();
  await page.locator('#task-weekday').selectOption('3');
  await page.locator('#task-at-time').fill('18:15');
  await expect(page.locator('#task-cron-expr')).toHaveCount(0);

  await repeat.selectOption('monthly');
  await expect(page.locator('#task-day-of-month')).toBeVisible();

  await repeat.selectOption('custom');
  await expect(page.locator('#task-cron-expr')).toBeVisible();
});

test('shows an existing cron a user wrote by hand as a custom expression', async ({ page }) => {
  await openTasks(page, [{ ...weekdayTask, cron_expr: '*/5 * * * *' }]);

  await expect(page.getByTestId('task-row-task-1')).toContainText('*/5 * * * *');

  const menu = await openRowActions(page, page.getByTestId('task-row-task-1'));
  await menu.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#task-repeat')).toHaveValue('custom');
  await expect(page.locator('#task-cron-expr')).toHaveValue('*/5 * * * *');
});
