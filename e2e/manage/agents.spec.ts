import { expect, test } from '@playwright/test';
import { WRITE_TIMESTAMP, boss, mockBackend, plain, seedSession } from '../support/mock-backend';
import { expectRowActions, openRowActions } from '../support/row-actions';
import { waitForShellStyles } from '../support/styles';

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

  await page.goto('/en/manage/agents');
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
  const createdMenu = await openRowActions(page, created);
  await createdMenu.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#agent-name')).toHaveValue('summariser');
  await page.locator('#agent-name').fill('summariser-pro');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'summariser-pro' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'summariser', exact: true })).toHaveCount(0);

  // Delete: the confirmation removes the agent.
  const renamed = page.getByRole('row').filter({ hasText: 'summariser-pro' });
  const renamedMenu = await openRowActions(page, renamed);
  await renamedMenu.getByRole('button', { name: 'Delete' }).click();
  await page.locator('[data-testid="form-modal"] .btn-error').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'summariser-pro' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'researcher' })).toBeVisible();
});

test('an empty agent list invites the first agent', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/manage/agents');
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

  await page.goto('/en/manage/agents');
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

  await page.goto('/en/manage/agents');
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

test('a superuser can share an agent with everyone', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, agents: [researcher] });
  await seedSession(page);

  await page.goto('/en/manage/agents');
  await waitForShellStyles(page);

  // Nothing is shared yet, so no row carries the badge.
  await expect(page.getByRole('row').filter({ hasText: 'researcher' }).getByText('Public')).toHaveCount(0);

  // The share flag is on screen for a superuser.
  await page.locator('#agents-page-create-btn').click();
  await expect(page.locator('#agent-is_public')).toBeVisible();
  await page.locator('#agent-name').fill('shared');
  await page.locator('#agent-is_public').check();
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // The flag reaches the API, which is what makes the agent usable by all.
  expect(backend.writes.find((write) => write.method === 'POST' && write.path === '/agents')?.body).toMatchObject({ is_public: true });
  await expect(page.getByRole('row').filter({ hasText: 'shared' }).getByText('Public')).toBeVisible();
});

test('a superuser can stop sharing an agent', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, agents: [{ ...researcher, id: 'agent-1', name: 'shared', is_public: true, owned: true }] });
  await seedSession(page);

  await page.goto('/en/manage/agents');
  await waitForShellStyles(page);

  const row = page.getByRole('row').filter({ hasText: 'shared' });
  await expect(row.getByText('Public')).toBeVisible();

  // The toggle reads back the agent's own flag, so a share can be withdrawn.
  const sharedMenu = await openRowActions(page, row);
  await sharedMenu.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#agent-is_public')).toBeChecked();
  await page.locator('#agent-is_public').uncheck();
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // Withdrawing the share reaches the API, which is what takes the agent off
  // every other user's list and clears the defaults they set on it.
  expect(backend.writes.find((write) => write.method === 'PUT' && write.path === '/agents/agent-1')?.body).toMatchObject({ is_public: false });
  await expect(page.getByRole('row').filter({ hasText: 'shared' }).getByText('Public')).toHaveCount(0);
});

test('a shared agent keeps its fields with its owner', async ({ page }) => {
  await mockBackend(page, {
    session: plain,
    agents: [
      { ...researcher, id: 'agent-1', name: 'mine', owned: true },
      { ...researcher, id: 'agent-2', name: 'shared', owned: false, is_public: true },
    ],
  });
  await seedSession(page);

  await page.goto('/en/manage/agents');
  await waitForShellStyles(page);

  // An ordinary user is never offered the share flag: the API answers 403.
  await page.locator('#agents-page-create-btn').click();
  await expect(page.locator('#agent-is_public')).toHaveCount(0);
  await page.locator('[data-testid="form-modal"] .btn-ghost').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // The fields of a shared agent belong to its owner: the row offers no edit and
  // no delete, only the read-only view.
  const shared = page.getByRole('row').filter({ hasText: 'shared' });
  await expect(shared.getByText('Public')).toBeVisible();
  await expect(shared.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(shared.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await expect(shared.getByRole('button', { name: 'View' })).toBeVisible();

  // The owner may read its own agent back as well as change it, and the row is
  // ordered the way every list in the app orders its actions: read, then write,
  // then the one that destroys.
  const mine = page.getByRole('row').filter({ hasText: 'mine' });
  await expectRowActions(page, mine, ['View', 'Edit', 'Delete']);
});

test('a shared agent is read back in a dialog that cannot write', async ({ page }) => {
  const backend = await mockBackend(page, {
    session: plain,
    agents: [{ ...researcher, id: 'agent-2', name: 'shared', owned: false, is_public: true }],
  });
  await seedSession(page);

  await page.goto('/en/manage/agents');
  await waitForShellStyles(page);

  await page.getByRole('row').filter({ hasText: 'shared' }).getByRole('button', { name: 'View' }).click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();

  // Every value the agent carries is on screen.
  await expect(page.locator('#agent-name')).toHaveValue('shared');
  await expect(page.locator('#agent-description')).toHaveValue('Finds sources');
  await expect(page.locator('#agent-tools-ReadFile')).toBeChecked();
  await expect(page.locator('#agent-tools-ReadFile')).toBeDisabled();
  await expect(page.locator('#agent-tools-WriteFile')).not.toBeChecked();
  await expect(page.locator('#agent-tools-WriteFile')).toBeDisabled();
  await expect(page.locator('#agent-prompts-RolePrompt')).toBeChecked();
  await expect(page.locator('#agent-prompts-RolePrompt')).toBeDisabled();

  // Nothing can be changed and there is no save action to write it with.
  await expect(page.locator('#agent-name')).toBeDisabled();
  await expect(page.locator('#agent-description')).toBeDisabled();
  await expect(page.locator('[data-testid="form-modal"] .modal-action .btn-primary')).toHaveCount(0);

  await expect(page.locator('[data-testid="form-modal"] .modal-action .btn-ghost')).toHaveText('Close');
  await page.locator('[data-testid="form-modal"] .modal-action .btn-ghost').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  // Reading an agent is a read: it never reaches the API as an agent write.
  expect(backend.writes.filter((write) => write.method !== 'GET' && write.path.startsWith('/agents'))).toHaveLength(0);
});
