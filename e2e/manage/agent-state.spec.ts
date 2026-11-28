import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockBackend } from '../support/mock-backend';

/**
 * Three agents covering the three answers the page has to render: one with a
 * board, one whose pair has never been written, and one shared agent, whose
 * board is the caller's own pair rather than its owner's.
 */
const agents = [
  { id: 'agent-1', name: 'Angel Holiday', description: 'Personal assistant', created_at: '2026-04-05T06:07:08Z', owned: true },
  { id: 'agent-2', name: 'Fresh Agent', description: '', created_at: '2026-04-06T07:08:09Z', owned: true },
  { id: 'agent-3', name: 'Shared Agent', description: '', created_at: '2026-04-07T08:09:10Z', owned: false, is_public: true },
];

const states = [
  {
    agent_id: 'agent-1',
    content: '## Now\n\n- Boss 想睇現況表\n- 等緊 **UI** 上線',
    version: 4,
    source: 'AGENT_CLOUD',
    created_at: '2026-10-18T00:00:00Z',
    updated_at: '2026-10-19T01:02:03Z',
  },
];

async function openState(page: Parameters<typeof seedSession>[0]) {
  const backend = await mockBackend(page, { session: boss, agents, states });
  await seedSession(page);
  await page.goto('/en/manage/agent-state');
  return backend;
}

test('the page is reachable from the sidebar and asks for a pick first', async ({ page }) => {
  await openState(page);

  await expect(page.getByRole('link', { name: 'Agent State' })).toBeVisible();
  await expect(page.getByTestId('state-no-selection')).toBeVisible();

  // Every agent is listed, but a board is only read for the one that is picked.
  await expect(page.getByTestId('state-agent-row-agent-1')).toBeVisible();
  await expect(page.getByTestId('state-board')).toHaveCount(0);
});

test("a shared agent offers the button too, since its board is the caller's own", async ({ page }) => {
  await openState(page);

  await expect(page.getByTestId('state-agent-open-agent-1')).toBeVisible();
  await expect(page.getByTestId('state-agent-row-agent-3')).toContainText('Shared Agent');
  await expect(page.getByTestId('state-agent-open-agent-3')).toBeVisible();
});

test('a picked agent shows its board as markdown with the version and source', async ({ page }) => {
  await openState(page);
  await page.getByTestId('state-agent-open-agent-1').click();

  const board = page.getByTestId('state-board');
  await expect(board).toBeVisible();
  await expect(page.getByTestId('state-board-agent')).toHaveText('Angel Holiday');
  await expect(page.getByTestId('state-board-version')).toHaveText('Version 4');
  await expect(page.getByTestId('state-board-source')).toHaveText('AGENT_CLOUD');

  // The board is markdown, so the heading and the emphasis are rendered rather
  // than printed as source.
  const content = page.getByTestId('state-board-content');
  await expect(content.getByRole('heading', { name: 'Now' })).toBeVisible();
  await expect(content.locator('strong')).toHaveText('UI');
});

test('a pair that was never written reads as an empty board, not an error', async ({ page }) => {
  await openState(page);
  await page.getByTestId('state-agent-open-agent-2').click();

  await expect(page.getByTestId('state-board-empty')).toContainText('no state board yet');
  await expect(page.getByTestId('state-board-error')).toHaveCount(0);
  await expect(page.getByTestId('state-board-content')).toHaveCount(0);
});

test('editing the board writes it back with the version that was read', async ({ page }) => {
  const backend = await openState(page);
  await page.getByTestId('state-agent-open-agent-1').click();
  await expect(page.getByTestId('state-board-version')).toHaveText('Version 4');

  await page.getByTestId('state-edit-agent-1').click();
  await expect(page.getByTestId('state-content-input')).toHaveValue(/Boss 想睇現況表/);

  await page.getByTestId('state-content-input').fill('## Now\n\n- 手改咗');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  // The version read is the version sent, so a concurrent writer is refused
  // rather than silently undone.
  await expect(page.getByTestId('state-board-version')).toHaveText('Version 5');
  await expect(page.getByTestId('state-board-content')).toContainText('手改咗');

  const write = backend.writes.find((entry) => entry.method === 'PUT' && entry.path === '/memory/state');
  expect(write?.body).toMatchObject({ agent_id: 'agent-1', version: 4, content: '## Now\n\n- 手改咗', source: 'AGENT_CLOUD' });
});

test('a board that was never written can be created from the same editor', async ({ page }) => {
  await openState(page);
  await page.getByTestId('state-agent-open-agent-2').click();
  await expect(page.getByTestId('state-board-empty')).toBeVisible();

  // No delete button: there is no row to remove yet.
  await expect(page.getByTestId('state-delete-agent-2')).toHaveCount(0);

  await page.getByTestId('state-edit-agent-2').click();
  await expect(page.getByTestId('state-content-input')).toHaveValue('');
  await page.getByTestId('state-content-input').fill('## Now\n\n- 第一張');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('state-board-version')).toHaveText('Version 1');
  await expect(page.getByTestId('state-board-empty')).toHaveCount(0);
});

test('an empty board is refused before it reaches the API', async ({ page }) => {
  const backend = await openState(page);
  await page.getByTestId('state-agent-open-agent-1').click();
  await page.getByTestId('state-edit-agent-1').click();

  await page.getByTestId('state-content-input').fill('   ');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('form-modal')).toBeVisible();
  expect(backend.writes.filter((entry) => entry.method === 'PUT' && entry.path === '/memory/state')).toHaveLength(0);
});

test('a conflict is reported and the newer board is shown instead', async ({ page }) => {
  const backend = await openState(page);
  await page.getByTestId('state-agent-open-agent-1').click();
  await page.getByTestId('state-edit-agent-1').click();

  // Another writer gets there first: the row now holds a version the page never
  // read, so the edit it is about to send is stale.
  const stored = backend.states[0];
  if (!stored) {
    throw new Error('the seeded board is missing');
  }
  stored.version = 9;
  stored.content = '## Now\n\n- 另一個寫入者';

  await page.getByTestId('state-content-input').fill('## Now\n\n- 我嘅版本');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('state-board-version')).toHaveText('Version 9');
  await expect(page.getByTestId('state-board-content')).toContainText('另一個寫入者');
});

test('a board over the ceiling is refused before it reaches the API', async ({ page }) => {
  const backend = await openState(page);
  await page.getByTestId('state-agent-open-agent-1').click();
  await page.getByTestId('state-edit-agent-1').click();

  await page.getByTestId('state-content-input').fill('字'.repeat(8001));

  await expect(page.getByTestId('state-char-count')).toContainText('8001 / 8000');
  await page.getByTestId('form-modal').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('form-modal')).toBeVisible();
  expect(backend.writes.filter((entry) => entry.method === 'PUT' && entry.path === '/memory/state')).toHaveLength(0);
});

test('deleting the board leaves the agent with the empty state', async ({ page }) => {
  const backend = await openState(page);
  await page.getByTestId('state-agent-open-agent-1').click();

  await page.getByTestId('state-delete-agent-1').click();
  await page.getByTestId('form-modal').getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByTestId('state-board-empty')).toBeVisible();
  await expect(page.getByTestId('state-delete-agent-1')).toHaveCount(0);
  expect(backend.states).toHaveLength(0);
});

/** The most recent write to the board-update switch, if the page made one. */
function stateUpdateWrite(backend: MockBackend) {
  return backend.writes.filter((write) => write.method === 'PUT' && write.path === '/user-config/memory.state_update').at(-1);
}

test('the board-update switch is on for an account that never touched it, and turning it off is stored', async ({ page }) => {
  const backend = await openState(page);

  const toggle = page.getByTestId('turn-write-toggle-stateUpdate');
  await expect(toggle).toBeChecked();

  await toggle.click();

  await expect.poll(() => stateUpdateWrite(backend)?.body).toEqual({ value: false });
  await expect(toggle).not.toBeChecked();
});

test('a stored board-update switch is shown as the account left it', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, agents, states, userConfig: { 'memory.state_update': false } });
  await seedSession(page);
  await page.goto('/en/manage/agent-state');

  const toggle = page.getByTestId('turn-write-toggle-stateUpdate');
  await expect(toggle).not.toBeChecked();

  await toggle.click();
  await expect.poll(() => stateUpdateWrite(backend)?.body).toEqual({ value: true });
  await expect(toggle).toBeChecked();
});
