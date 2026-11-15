import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession } from '../support/mock-backend';
import { openRowActions } from '../support/row-actions';
import { waitForShellStyles } from '../support/styles';

// `YYYY-MM-DD HH:MM:SS`, the one timestamp shape the UI renders.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const researcher = { id: 'agent-1', name: 'researcher', description: 'Finds sources', created_at: '2026-04-05T06:07:08Z' };
const summariser = { id: 'agent-2', name: 'summariser', description: 'Shortens texts', created_at: '2026-04-05T06:07:08Z' };

test('lists, sets, edits and removes Agent Defaults', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    agents: [researcher, summariser],
    agentDefaults: [{ source: 'TUI', agent_id: 'agent-1' }],
  });
  await seedSession(page);

  await page.goto('/en/manage/agent-defaults');
  await waitForShellStyles(page);

  // The entry is wired into the shell like every other page.
  await expect(page.getByRole('list').getByRole('link', { name: 'Agent Defaults' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Agent Defaults' })).toBeVisible();

  // The stored default names its source, resolves the agent id to a name, and
  // shows both of the API's timestamps.
  const row = page.getByRole('row').filter({ hasText: 'TUI' });
  await expect(row.getByRole('cell', { name: 'TUI' })).toBeVisible();
  await expect(row.getByRole('cell', { name: 'researcher' })).toBeVisible();
  await expect(row.getByRole('cell').nth(2)).toHaveText(TIMESTAMP);
  await expect(row.getByRole('cell').nth(3)).toHaveText(TIMESTAMP);

  // Set a default for the other known source. The dialog opens on it, as TUI is
  // already taken.
  await page.locator('#agent-defaults-page-create-btn').click();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();
  await expect(page.locator('#agent-default-source')).toHaveValue('AGENT_CLOUD');
  await page.selectOption('#agent-default-agent', { label: 'summariser' });
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  const cloud = page.getByRole('row').filter({ hasText: 'AGENT_CLOUD' });
  await expect(cloud.getByRole('cell', { name: 'summariser' })).toBeVisible();

  // Editing keeps the source — it is the key the default is stored under — and
  // switches the agent.
  const menu = await openRowActions(page, cloud);
  await menu.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#agent-default-source')).toBeDisabled();
  await expect(page.locator('#agent-default-source')).toHaveValue('AGENT_CLOUD');
  await page.selectOption('#agent-default-agent', { label: 'researcher' });
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'AGENT_CLOUD' }).getByRole('cell', { name: 'researcher' })).toBeVisible();

  // Removing one default leaves the other alone.
  const removeMenu = await openRowActions(page, page.getByRole('row').filter({ hasText: 'AGENT_CLOUD' }));
  await removeMenu.getByRole('button', { name: 'Delete' }).click();
  await page.locator('[data-testid="form-modal"] .btn-error').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'AGENT_CLOUD' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'TUI' })).toBeVisible();
});

test('the picker takes a source the build has never heard of', async ({ page }) => {
  await mockBackend(page, { session: boss, agents: [researcher] });
  await seedSession(page);

  await page.goto('/en/manage/agent-defaults');
  await waitForShellStyles(page);

  await page.locator('#agent-defaults-page-create-btn').click();
  await page.locator('#agent-default-source').selectOption({ label: 'Other' });

  // The free-text field only exists once that choice is made.
  await expect(page.locator('#agent-default-custom-source')).toBeVisible();
  await page.locator('#agent-default-custom-source').fill('VOICE');
  await page.selectOption('#agent-default-agent', { label: 'researcher' });
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  await expect(page.getByRole('cell', { name: 'VOICE', exact: true })).toBeVisible();
});

test('a default whose agent is gone still shows what it points at', async ({ page }) => {
  await mockBackend(page, { session: boss, agents: [], agentDefaults: [{ source: 'TUI', agent_id: 'agent-gone' }] });
  await seedSession(page);

  await page.goto('/en/manage/agent-defaults');
  await waitForShellStyles(page);

  // Nothing can name the agent, so the stored id stands in for it rather than the
  // cell going blank.
  await expect(page.getByRole('cell', { name: 'agent-gone' })).toBeVisible();

  // The picker offers that id too, so opening and saving it untouched keeps the
  // default instead of dropping it.
  const menu = await openRowActions(page, page.getByRole('row').filter({ hasText: 'TUI' }));
  await menu.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#agent-default-agent')).toHaveValue('agent-gone');
});

test('an empty default list invites the first one', async ({ page }) => {
  await mockBackend(page, { session: boss, agents: [researcher] });
  await seedSession(page);

  await page.goto('/en/manage/agent-defaults');
  await waitForShellStyles(page);

  await expect(page.getByText('No Agent Defaults found.')).toBeVisible();
  await expect(page.locator('#agent-defaults-page-create-first-btn')).toBeVisible();
});

test('saving without an agent is refused', async ({ page }) => {
  await mockBackend(page, { session: boss, agents: [researcher] });
  await seedSession(page);

  await page.goto('/en/manage/agent-defaults');
  await waitForShellStyles(page);

  await page.locator('#agent-defaults-page-create-btn').click();
  await page.locator('[data-testid="form-modal"] .btn-primary').click();

  await expect(page.getByText('Please choose an agent')).toBeVisible();
  await expect(page.locator('[data-testid="form-modal-box"]')).toBeVisible();
});
