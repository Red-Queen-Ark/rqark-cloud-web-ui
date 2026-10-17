import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockTask, type MockTaskRun } from './support/mock-backend';

const SESSION_ID = 'dddddddd-1111-4111-8111-dddddddddddd';

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

const runs: MockTaskRun[] = [
  {
    id: 'run-1',
    task_id: task.id,
    status: 'ok',
    trigger: 'schedule',
    scheduled_at: '2026-10-17T01:00:00Z',
    started_at: '2026-10-17T01:00:01Z',
    finished_at: '2026-10-17T01:00:13Z',
    error: '',
    session_id: SESSION_ID,
  },
  {
    id: 'run-2',
    task_id: task.id,
    status: 'error',
    trigger: 'manual',
    scheduled_at: '2026-10-17T02:00:00Z',
    started_at: '2026-10-17T02:00:01Z',
    finished_at: '2026-10-17T02:00:31Z',
    error: 'timeout',
    session_id: null,
  },
];

const transcriptSession = {
  id: SESSION_ID,
  title: 'Morning brief',
  source: 'TASK',
  created_at: '2026-10-17T01:00:00Z',
  updated_at: '2026-10-17T01:00:13Z',
  plan_items: [{ id: 'p1', content: 'Read the inbox', status: 'completed' }],
  messages: [
    {
      seq: 0,
      role: 'user',
      created_at: '2026-10-17T01:00:01Z',
      data: { role: 'user', content: [{ type: 'text', text: 'Summarise my inbox.' }], created_at: '2026-10-17T01:00:01Z' },
    },
    {
      seq: 1,
      role: 'assistant',
      created_at: '2026-10-17T01:00:13Z',
      data: { role: 'assistant', content: 'Three things need you today.', created_at: '2026-10-17T01:00:13Z' },
    },
  ],
};

async function openTasks(page: Page, tasks: MockTask[] = [task], taskRuns: MockTaskRun[] = runs) {
  const backend = await mockBackend(page, {
    session: boss,
    tasks,
    taskRuns,
    sessions: [transcriptSession],
    agents: [{ id: 'agent-1', name: 'Angel Holiday', description: '', created_at: '2026-10-01T00:00:00Z' }],
    providers: [{ id: 'provider-1', name: 'gpt-5', model_name: 'gpt-5', created_at: '2026-10-01T00:00:00Z' }],
  });
  await seedSession(page);
  await page.goto('/en/tasks');
  return backend;
}

test('a task row opens its detail, which lists the runs', async ({ page }) => {
  await openTasks(page);

  await page.getByTestId('task-view-task-1').click();

  await expect(page).toHaveURL(/\/en\/tasks\/task-1$/);
  await expect(page.getByTestId('task-detail-name')).toHaveText('Morning brief');
  await expect(page.getByTestId('task-detail-schedule')).toContainText('Every day at 09:00');
  await expect(page.getByTestId('task-detail-prompt')).toHaveText('Summarise my inbox.');

  await expect(page.getByTestId('task-detail-runs-table')).toBeVisible();
  await expect(page.getByTestId('task-detail-runs-table')).toContainText('OK');
  await expect(page.getByTestId('task-detail-runs-table')).toContainText('Error');
  await expect(page.getByTestId('task-detail-runs-table')).toContainText('timeout');
});

test('a run states how long it took, and one that never finished states nothing', async ({ page }) => {
  await openTasks(
    page,
    [task],
    [
      ...runs,
      {
        id: 'run-3',
        task_id: task.id,
        status: 'running',
        trigger: 'schedule',
        scheduled_at: '2026-10-17T03:00:00Z',
        started_at: '2026-10-17T03:00:01Z',
        finished_at: null,
        error: '',
        session_id: null,
      },
    ],
  );
  await page.getByTestId('task-view-task-1').click();

  // 12 seconds.
  await expect(page.getByTestId('task-run-row-run-1')).toContainText('12.0 s');
  // 30 seconds.
  await expect(page.getByTestId('task-run-row-run-2')).toContainText('30.0 s');
  // Still running: no figure that would read as a finished one.
  await expect(page.getByTestId('task-run-row-run-3')).toContainText('Running');
  await expect(page.getByTestId('task-run-row-run-3')).toContainText('—');
});

test('a run opens its transcript read only', async ({ page }) => {
  await openTasks(page);
  await page.getByTestId('task-view-task-1').click();

  await page.getByTestId('task-run-view-run-1').click();

  await expect(page).toHaveURL(new RegExp(`/en/tasks/task-1/sessions/${SESSION_ID}$`));
  await expect(page.getByTestId('task-session-history')).toContainText('Summarise my inbox.');
  await expect(page.getByTestId('task-session-history')).toContainText('Three things need you today.');
  await expect(page.getByTestId('task-session-page')).toContainText('A run is read only');

  // A run is not a conversation: there is nothing to type into.
  await expect(page.getByTestId('chat-input')).toHaveCount(0);
});

test('a run that opened no session offers no transcript', async ({ page }) => {
  await openTasks(page);
  await page.getByTestId('task-view-task-1').click();

  await expect(page.getByTestId('task-run-view-run-2')).toHaveCount(0);
});

test('a task that is not there says so instead of failing', async ({ page }) => {
  await openTasks(page);
  await page.goto('/en/tasks/no-such-task');

  await expect(page.getByTestId('task-detail-not-found')).toBeVisible();
  await expect(page.getByTestId('task-detail-not-found')).toContainText('No such task.');
});

test('the runs are paged, newest first', async ({ page }) => {
  const many: MockTaskRun[] = Array.from({ length: 21 }, (_, index) => ({
    id: `run-${index}`,
    task_id: task.id,
    status: 'ok',
    trigger: 'schedule',
    scheduled_at: `2026-10-${String(index + 1).padStart(2, '0')}T01:00:00Z`,
    started_at: `2026-10-${String(index + 1).padStart(2, '0')}T01:00:01Z`,
    finished_at: `2026-10-${String(index + 1).padStart(2, '0')}T01:00:05Z`,
    error: '',
    session_id: null,
  }));

  await openTasks(page, [task], many);
  await page.getByTestId('task-view-task-1').click();

  // 20 per page: the newest is on the first page, the oldest is not.
  await expect(page.getByTestId('task-run-row-run-20')).toBeVisible();
  await expect(page.getByTestId('task-run-row-run-0')).toHaveCount(0);

  await page.locator('#task-detail-runs-next').click();

  await expect(page.getByTestId('task-run-row-run-0')).toBeVisible();
  await expect(page.locator('#task-detail-runs-next')).toBeDisabled();
});

test('the back link returns to the task list, and sits above the task card', async ({ page }) => {
  await openTasks(page);
  await page.getByTestId('task-view-task-1').click();

  // The name lives in the card with the task's own facts, so the way back is a
  // row of its own above it rather than competing with it on one line.
  const back = await page.locator('#task-detail-back-btn').boundingBox();
  const name = await page.getByTestId('task-detail-name').boundingBox();
  expect(back && name && back.y < name.y).toBe(true);

  await page.locator('#task-detail-back-btn').click();
  await expect(page).toHaveURL(/\/en\/tasks$/);
});

test('the transcript page puts its back link above the heading', async ({ page }) => {
  await openTasks(page);
  await page.getByTestId('task-view-task-1').click();
  await page.getByTestId('task-run-view-run-1').click();

  const back = await page.locator('#task-session-back-btn').boundingBox();
  const title = await page.getByTestId('task-session-title').boundingBox();
  expect(back && title && back.y < title.y).toBe(true);

  await page.locator('#task-session-back-btn').click();
  await expect(page).toHaveURL(/\/en\/tasks\/task-1$/);
});
