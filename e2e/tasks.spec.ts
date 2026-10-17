import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockTask } from './support/mock-backend';

const morning: MockTask = {
  id: 'task-1',
  name: 'Morning brief',
  prompt: 'Summarise my inbox.',
  agent_name: 'Angel Holiday',
  provider_name: 'openai',
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

const hourly: MockTask = {
  id: 'task-2',
  name: 'Hourly sweep',
  prompt: 'Check the queue.',
  agent_name: 'Angel Holiday',
  provider_name: 'openai',
  timezone: 'UTC',
  enabled: false,
  schedule_kind: 'every',
  run_at: null,
  every_seconds: 3600,
  cron_expr: null,
  next_run_at: null,
  created_at: '2026-10-03T02:03:04Z',
  updated_at: '2026-10-03T02:03:04Z',
};

async function openTasks(page: Page, tasks: MockTask[] = []) {
  const backend = await mockBackend(page, {
    session: boss,
    tasks,
    agents: [{ id: 'agent-1', name: 'Angel Holiday', description: '', created_at: '2026-10-01T00:00:00Z' }],
    providers: [{ id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-10-01T00:00:00Z' }],
  });
  await seedSession(page);
  await page.goto('/en/tasks');
  return backend;
}

test('the sidebar links to the task page', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.goto('/en');

  await page.getByTestId('sidebar-tasks-link').click();

  await expect(page).toHaveURL(/\/en\/tasks$/);
  await expect(page.getByTestId('task-page')).toBeVisible();
});

test('an empty list explains itself', async ({ page }) => {
  await openTasks(page);

  await expect(page.getByTestId('task-page-empty')).toBeVisible();
  await expect(page.getByText('No tasks yet.')).toBeVisible();
});

test('lists every task with its schedule and state', async ({ page }) => {
  await openTasks(page, [morning, hourly]);

  await expect(page.getByTestId('task-row-task-1')).toContainText('Morning brief');
  await expect(page.getByTestId('task-row-task-1')).toContainText('Every day at 09:00');
  await expect(page.getByTestId('task-row-task-1')).toContainText('Asia/Hong_Kong');
  await expect(page.getByTestId('task-row-task-1')).toContainText('On');

  await expect(page.getByTestId('task-row-task-2')).toContainText('Every 1 h');
  await expect(page.getByTestId('task-row-task-2')).toContainText('Paused');
  await expect(page.getByTestId('task-row-task-2')).toContainText('Not scheduled');
});

test('creates a cron task', async ({ page }) => {
  const backend = await openTasks(page);

  await page.locator('#task-page-create-first-btn').click();
  await page.locator('#task-name').fill('Nightly digest');
  await page.locator('#task-prompt').fill('Summarise the day.');
  await page.locator('#task-agent').selectOption('Angel Holiday');
  await page.locator('#task-provider').selectOption('openai');
  await page.locator('#task-kind-cron').click();
  await page.locator('#task-repeat').selectOption('daily');
  await page.locator('#task-at-time').fill('22:30');
  await page.locator('#task-timezone').fill('Asia/Hong_Kong');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('task-row-task-1')).toContainText('Nightly digest');
  const write = backend.writes.find((entry) => entry.method === 'POST' && entry.path === '/tasks');
  expect(write?.body).toMatchObject({
    name: 'Nightly digest',
    prompt: 'Summarise the day.',
    agent_name: 'Angel Holiday',
    provider_name: 'openai',
    schedule_kind: 'cron',
    cron_expr: '30 22 * * *',
    timezone: 'Asia/Hong_Kong',
    enabled: true,
  });
  expect(write?.body).not.toHaveProperty('run_at');
  expect(write?.body).not.toHaveProperty('every_seconds');
});

test('creates an every task in whole minutes', async ({ page }) => {
  const backend = await openTasks(page);

  await page.locator('#task-page-create-btn').click();
  await page.locator('#task-name').fill('Poll queue');
  await page.locator('#task-prompt').fill('Any new jobs?');
  await page.locator('#task-agent').selectOption('Angel Holiday');
  await page.locator('#task-provider').selectOption('openai');
  await page.locator('#task-kind-every').click();
  await page.locator('#task-every-minutes').fill('90');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('task-row-task-1')).toContainText('Poll queue');
  const write = backend.writes.find((entry) => entry.method === 'POST' && entry.path === '/tasks');
  expect(write?.body).toMatchObject({ schedule_kind: 'every', every_seconds: 5400 });
  expect(write?.body).not.toHaveProperty('cron_expr');
});

test('edits a task and pauses it', async ({ page }) => {
  const backend = await openTasks(page, [morning]);

  await page.getByTestId('task-row-task-1').getByRole('button', { name: 'Edit' }).click();
  await page.locator('#task-name').fill('Evening brief');
  await page.locator('#task-enabled').uncheck();
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('task-row-task-1')).toContainText('Evening brief');
  await expect(page.getByTestId('task-row-task-1')).toContainText('Paused');
  const write = backend.writes.find((entry) => entry.method === 'PUT' && entry.path === '/tasks/task-1');
  expect(write?.body).toMatchObject({ name: 'Evening brief', enabled: false });
});

test('deletes a task after confirming', async ({ page }) => {
  await openTasks(page, [morning, hourly]);

  await page.getByTestId('task-row-task-1').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('form-modal')).toContainText('Delete Morning brief?');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByTestId('task-row-task-1')).toHaveCount(0);
  await expect(page.getByTestId('task-row-task-2')).toBeVisible();
});

test('keeps the enable switch beside the title and the name on its own row', async ({ page }) => {
  await openTasks(page);

  await page.locator('#task-page-create-btn').click();

  const title = await page.getByTestId('form-modal').locator('h3').boundingBox();
  const toggle = await page.locator('#task-enabled').boundingBox();
  const name = await page.locator('#task-name').boundingBox();
  const agent = await page.locator('#task-agent').boundingBox();
  const prompt = await page.locator('#task-prompt').boundingBox();

  expect(title && toggle && Math.abs(title.y - toggle.y) < 20).toBe(true);
  expect(name && toggle && name.y > toggle.y).toBe(true);
  expect(agent && prompt && prompt.y > agent.y).toBe(true);
});

test('refuses to create a task without a name', async ({ page }) => {
  const backend = await openTasks(page);

  await page.locator('#task-page-create-first-btn').click();
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Please enter a task name')).toBeVisible();
  expect(backend.writes.some((entry) => entry.method === 'POST' && entry.path === '/tasks')).toBe(false);
});
