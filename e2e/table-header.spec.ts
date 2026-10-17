import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockTask } from './support/mock-backend';

/** Enough rows that the table has to scroll inside its own panel. */
const many: MockTask[] = Array.from({ length: 40 }, (_, index) => ({
  id: `task-${index}`,
  name: `Task ${String(index).padStart(2, '0')}`,
  prompt: 'Say hello.',
  agent_name: 'Angel Holiday',
  provider_name: 'gpt-5',
  timezone: 'UTC',
  enabled: true,
  schedule_kind: 'cron',
  run_at: null,
  every_seconds: null,
  cron_expr: '0 9 * * *',
  next_run_at: '2026-10-18T01:00:00Z',
  created_at: '2026-10-01T02:03:04Z',
  updated_at: '2026-10-02T03:04:05Z',
}));

test('the task list keeps its column names in view while the rows scroll', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    tasks: many,
    agents: [{ id: 'agent-1', name: 'Angel Holiday', description: '', created_at: '2026-10-01T00:00:00Z' }],
    providers: [{ id: 'provider-1', name: 'gpt-5', model_name: 'gpt-5', created_at: '2026-10-01T00:00:00Z' }],
  });
  await seedSession(page);
  await page.goto('/en/tasks');

  // daisyUI pins the head row itself, not the `thead` box around it.
  const head = page.getByTestId('task-page-table').locator('thead tr');
  const before = await head.boundingBox();
  expect(before).not.toBeNull();

  // Something has to be scrollable for a pinned head to mean anything.
  const scrollable = await page.locator('[data-testid="task-page-table"]').evaluate((table) => {
    const box = table.parentElement as HTMLElement;
    return { client: box.clientHeight, scroll: box.scrollHeight };
  });
  expect(scrollable.scroll).toBeGreaterThan(scrollable.client);

  await page.getByTestId('task-page-table').evaluate((table) => {
    (table.parentElement as HTMLElement).scrollTop = 600;
  });
  await page.waitForTimeout(100);

  const after = await head.boundingBox();
  // The head holds its place instead of sliding up with the rows.
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2);
  await expect(page.getByTestId('task-row-task-39')).toBeVisible();
});
