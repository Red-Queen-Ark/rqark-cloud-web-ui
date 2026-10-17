import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockTask, type MockTaskRun } from './support/mock-backend';

const task: MockTask = {
  id: 'task-1',
  name: 'Morning brief',
  prompt: 'Summarise my inbox in five bullets, then file the rest.',
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

const runs: MockTaskRun[] = Array.from({ length: 30 }, (_, index) => ({
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

async function openDetail(page: import('@playwright/test').Page) {
  await mockBackend(page, {
    session: boss,
    tasks: [task],
    taskRuns: runs,
    agents: [{ id: 'agent-1', name: 'Angel Holiday', description: '', created_at: '2026-10-01T00:00:00Z' }],
    providers: [{ id: 'provider-1', name: 'gpt-5', model_name: 'gpt-5', created_at: '2026-10-01T00:00:00Z' }],
  });
  await seedSession(page);
  await page.goto('/en/tasks/task-1');
}

test('a task with a long run history still fits the screen', async ({ page }) => {
  await openDetail(page);

  // The shell must not scroll: the runs scroll inside their panel instead, so the
  // task's own facts stay where the reader left them.
  const shell = await page.locator('#app-scroll').evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
  expect(shell.scroll).toBeLessThanOrEqual(shell.client + 1);

  // And the page really is inside the viewport, not merely clipped by CSS.
  const page_ = await page.getByTestId('task-detail-page').boundingBox();
  const viewport = page.viewportSize();
  expect(page_ && viewport && page_.y + page_.height <= viewport.height).toBe(true);

  // The runs have their own scrollbar, which is the thing that makes this work.
  const table = await page.getByTestId('task-detail-runs-table').evaluate((el) => {
    const box = el.parentElement as HTMLElement;
    return { client: box.clientHeight, scroll: box.scrollHeight };
  });
  expect(table.scroll).toBeGreaterThan(table.client);
});

test('the runs head stays in view while its rows scroll', async ({ page }) => {
  await openDetail(page);

  const head = page.getByTestId('task-detail-runs-table').locator('thead tr');
  const before = await head.boundingBox();

  await page.getByTestId('task-detail-runs-table').evaluate((el) => {
    (el.parentElement as HTMLElement).scrollTop = 400;
  });
  await page.waitForTimeout(100);

  const after = await head.boundingBox();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2);
});

test('a short run history leaves the page with room to spare', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    tasks: [task],
    taskRuns: [],
    agents: [{ id: 'agent-1', name: 'Angel Holiday', description: '', created_at: '2026-10-01T00:00:00Z' }],
    providers: [{ id: 'provider-1', name: 'gpt-5', model_name: 'gpt-5', created_at: '2026-10-01T00:00:00Z' }],
  });
  await seedSession(page);
  await page.goto('/en/tasks/task-1');

  await expect(page.getByTestId('task-detail-runs-empty')).toBeVisible();

  const shell = await page.locator('#app-scroll').evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
  expect(shell.scroll).toBeLessThanOrEqual(shell.client + 1);
});
