import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

// `YYYY-MM-DD HH:MM:SS`: date *and* time, zero padded, seconds included.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** The instant the API string points at, so the rendered text can be compared without hardcoding a timezone. */
async function instantOf(stamp: string): Promise<number> {
  return new Date(stamp.replace(' ', 'T')).getTime();
}

const CREATED_AT = '2026-04-05T06:07:08Z';
const UPDATED_AT = '2026-04-06T07:08:09Z';

test('every timestamp in the UI renders as YYYY-MM-DD HH:MM:SS', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockBackend(page, {
    session: boss,
    agents: [{ id: 'agent-1', name: 'researcher', description: 'Finds sources', created_at: CREATED_AT, updated_at: UPDATED_AT }],
    providers: [{ id: 'provider-1', name: 'deepseek', model_name: 'deepseek-v4-pro', created_at: CREATED_AT, updated_at: UPDATED_AT }],
    groups: [{ id: 'group-1', name: 'engineering', created_at: CREATED_AT, memberIds: [] }],
  });
  await seedSession(page);

  // Agents page: Created and Updated each carry their own instant, time included.
  await page.goto('/en/agents');
  await waitForShellStyles(page);
  const agentCells = page.getByRole('row').filter({ hasText: 'researcher' }).getByRole('cell');
  const agentCreated = agentCells.nth(4);
  const agentUpdated = agentCells.nth(5);
  await expect(agentCreated).toHaveText(TIMESTAMP);
  await expect(agentUpdated).toHaveText(TIMESTAMP);
  expect(await instantOf(await agentCreated.innerText())).toBe(new Date(CREATED_AT).getTime());
  expect(await instantOf(await agentUpdated.innerText())).toBe(new Date(UPDATED_AT).getTime());

  // Providers page: same two columns, same shape.
  await page.goto('/en/providers');
  await waitForShellStyles(page);
  const providerCells = page.getByRole('row').filter({ hasText: 'deepseek' }).getByRole('cell');
  const providerCreated = providerCells.nth(4);
  const providerUpdated = providerCells.nth(5);
  await expect(providerCreated).toHaveText(TIMESTAMP);
  await expect(providerUpdated).toHaveText(TIMESTAMP);
  expect(await instantOf(await providerCreated.innerText())).toBe(new Date(CREATED_AT).getTime());
  expect(await instantOf(await providerUpdated.innerText())).toBe(new Date(UPDATED_AT).getTime());

  // Groups page: created only, same shape.
  await page.goto('/en/groups');
  await waitForShellStyles(page);
  const groupStamp = page.getByRole('row').filter({ hasText: 'engineering' }).getByRole('cell', { name: TIMESTAMP });
  await expect(groupStamp).toBeVisible();
  expect(await instantOf(await groupStamp.innerText())).toBe(new Date(CREATED_AT).getTime());
});

test('a resource the API never updated shows a dash rather than a made-up time', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    agents: [{ id: 'agent-1', name: 'researcher', description: '', created_at: CREATED_AT }],
    providers: [{ id: 'provider-1', name: 'deepseek', model_name: 'deepseek-v4-pro', created_at: CREATED_AT }],
  });
  await seedSession(page);

  await page.goto('/en/agents');
  await waitForShellStyles(page);
  await expect(page.getByRole('row').filter({ hasText: 'researcher' }).getByRole('cell').nth(5)).toHaveText('—');

  await page.goto('/en/providers');
  await waitForShellStyles(page);
  await expect(page.getByRole('row').filter({ hasText: 'deepseek' }).getByRole('cell').nth(5)).toHaveText('—');
});
