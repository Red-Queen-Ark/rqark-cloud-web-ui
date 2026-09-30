import { expect, test } from '@playwright/test';
import { WRITE_TIMESTAMP, boss, mockBackend, seedSession } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

// `YYYY-MM-DD HH:MM:SS`, the one timestamp shape the UI renders.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** The instant a rendered `YYYY-MM-DD HH:MM:SS` string points at. */
async function instantOf(stamp: string): Promise<number> {
  return new Date(stamp.replace(' ', 'T')).getTime();
}

const researcher = {
  id: 'agent-1',
  name: 'researcher',
  description: 'Finds sources',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-06T07:08:09Z',
  tools: [{ name: 'ReadFile' }, { name: 'WebSearch' }, { name: 'SubAgent', params: { prompts: [], tools: [{ name: 'WebSearch' }] } }],
  prompts: [{ name: 'RolePrompt' }],
};

test('lists, creates, edits and deletes agents', async ({ page }) => {
  await mockBackend(page, { session: boss, agents: [researcher] });
  await seedSession(page);

  await page.goto('/en/agents');
  await waitForShellStyles(page);

  // The row counts each component list, marks whether the subagent tool is one
  // of the tools, and shows both of the API's timestamps.
  const row = page.getByRole('row').filter({ hasText: 'researcher' });
  await expect(row.getByRole('cell', { name: 'researcher' })).toBeVisible();
  await expect(row.getByRole('cell').nth(1)).toHaveText('3');
  await expect(row.getByRole('cell').nth(2)).toHaveText('1');
  await expect(row.getByRole('cell').nth(3)).toHaveText('✓');
  await expect(row.getByRole('cell').nth(4)).toHaveText(TIMESTAMP);
  await expect(row.getByRole('cell').nth(5)).toHaveText(TIMESTAMP);
  // Created and Updated are different instants, and each renders its own.
  expect(await row.getByRole('cell').nth(4).innerText()).not.toBe(await row.getByRole('cell').nth(5).innerText());

  // Create an agent with nothing selected on it. The API answers without an
  // updated_at, so that cell falls back rather than inventing a time.
  await page.locator('#agents-page-create-btn').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();
  await page.locator('#agent-name').fill('summariser');
  await page.locator('#agent-description').fill('Summarises long documents');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  const created = page.getByRole('row').filter({ hasText: 'summariser' });
  await expect(created.getByRole('cell')).toHaveCount(7);
  await expect(created.getByRole('cell').nth(1)).toHaveText('0');
  await expect(created.getByRole('cell').nth(2)).toHaveText('0');
  await expect(created.getByRole('cell').nth(3)).toHaveText('—');
  await expect(created.getByRole('cell').nth(4)).toHaveText(TIMESTAMP);
  // The mock stamps a create with the same instant it stamps an update with,
  // so the fresh row shows that time in Updated rather than a blank.
  await expect(created.getByRole('cell').nth(5)).toHaveText(TIMESTAMP);
  expect(await instantOf(await created.getByRole('cell').nth(5).innerText())).toBe(new Date(WRITE_TIMESTAMP).getTime());

  // Edit: the dialog is prefilled and the change is persisted.
  await created.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#agent-name')).toHaveValue('summariser');
  await page.locator('#agent-name').fill('summariser-pro');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'summariser-pro' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'summariser', exact: true })).toHaveCount(0);

  // Delete: the confirmation removes the agent.
  await page.getByRole('row').filter({ hasText: 'summariser-pro' }).getByRole('button', { name: 'Delete' }).click();
  await page.locator('[data-testid="form-modal"] .btn-error').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'summariser-pro' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'researcher' })).toBeVisible();
});

test('an empty agent list invites the first agent', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/agents');
  await waitForShellStyles(page);

  await expect(page.getByText('No agents found.')).toBeVisible();
  await expect(page.locator('#agents-page-create-first-btn')).toBeVisible();
});

test('the agent list shows the whole collection in one request', async ({ page }) => {
  const many = Array.from({ length: 25 }, (_, index) => ({
    id: `agent-${index}`,
    name: `agent${String(index).padStart(2, '0')}`,
    description: `Description ${index}`,
    created_at: '2026-04-05T06:07:08Z',
  }));
  const backend = await mockBackend(page, { session: boss, agents: many });
  await seedSession(page);

  await page.goto('/en/agents');
  await waitForShellStyles(page);

  // The endpoint is not paginated: every agent is on the page at once.
  await expect(page.getByRole('cell', { name: 'agent00' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'agent10' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'agent24' })).toBeVisible();

  // Only the initial load ever reads the collection.
  expect(backend.requests.filter((request) => request === 'GET /agents')).toHaveLength(1);

  // With a single page there is nothing to page through.
  await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Previous' })).toHaveCount(0);
});

test('the agent table keeps every column on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockBackend(page, { session: boss, agents: [researcher] });
  await seedSession(page);

  await page.goto('/en/agents');
  await waitForShellStyles(page);

  // No column is dropped at this width the way `hidden sm:table-cell` used to.
  for (const header of ['Name', 'Tools', 'Prompts', 'Subagent', 'Created', 'Updated', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
  }

  const row = page.getByRole('row').filter({ hasText: 'researcher' });
  await expect(row.getByRole('cell')).toHaveCount(7);
  await expect(row.getByRole('cell').nth(4)).toHaveText(TIMESTAMP);
  await expect(row.getByRole('cell').nth(5)).toHaveText(TIMESTAMP);

  // The table scrolls sideways rather than squeezing the data out of reach.
  const scrolls = await page.locator('[data-testid="data-list-panel"] .overflow-x-auto').evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(scrolls).toBe(true);
});
