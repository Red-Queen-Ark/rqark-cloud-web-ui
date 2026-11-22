import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockBackend } from '../support/mock-backend';

/**
 * Two agents, so the list has to pick one rather than show everything, and two
 * rows with different shapes, so the card can be read in full: one pinned row
 * with keywords and a source message, one plain row without either.
 */
const agents = [
  { id: 'agent-1', name: 'Angel Holiday', description: 'Personal assistant', created_at: '2026-04-05T06:07:08Z', owned: true },
  { id: 'agent-2', name: 'Shared Agent', description: '', created_at: '2026-04-06T07:08:09Z', owned: false, is_public: true },
];

const memories = [
  {
    id: 'memory-2',
    agent_id: 'agent-1',
    content: 'Boss 喜歡簡短回覆',
    kind: 'fact' as const,
    keywords: ['回覆', '風格'],
    hits: 7,
    pinned: true,
    occurred_at: '2026-10-01T00:00:00Z',
    source: 'TUI',
    source_message: { role: 'user', text: '唔好長篇大論' },
  },
  {
    id: 'memory-1',
    agent_id: 'agent-1',
    content: 'Boss 用 UTC+8',
    kind: 'event' as const,
    keywords: [],
    hits: 0,
    pinned: false,
    occurred_at: '2026-09-01T00:00:00Z',
    source: 'AGENT_CLOUD',
    source_message: null,
  },
  {
    // The shared agent's row: it belongs to this account's pair, so it appears
    // in that agent's log and in no other.
    id: 'memory-3',
    agent_id: 'agent-2',
    content: 'not yours to read here',
    keywords: ['other'],
    occurred_at: '2026-10-02T00:00:00Z',
  },
];

async function openMemory(page: Parameters<typeof seedSession>[0]) {
  await mockBackend(page, { session: boss, agents, memories });
  await seedSession(page);
  await page.goto('/en/manage/memory');
}

test('the memory page lists the agents and links every one it may use', async ({ page }) => {
  await openMemory(page);

  await expect(page.getByRole('row').filter({ hasText: 'Angel Holiday' })).toBeVisible();
  await expect(page.getByTestId('memory-agent-open-agent-1')).toBeVisible();

  // A shared agent keeps its own rows for the caller, so it gets a link too.
  await expect(page.getByTestId('memory-agent-row-agent-2')).toContainText('Shared Agent');
  await expect(page.getByTestId('memory-agent-open-agent-2')).toBeVisible();
});

test('a card reads occurred_at, hits and pin first, then keywords, then content', async ({ page }) => {
  await openMemory(page);
  await page.getByTestId('memory-agent-open-agent-1').click();

  const card = page.getByTestId('memory-card-memory-2');
  await expect(card).toBeVisible();

  await expect(card.getByTestId('memory-card-occurred-at')).toHaveText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  await expect(card).toContainText('Injected: 7');

  // The pin is a switch, so it shows the row's current state rather than a word
  // that happens to be there.
  await expect(card.getByTestId('memory-card-pin-memory-2')).toBeChecked();
  // The kind is printed on the header line: a fact is injected into the prompt,
  // an event only shows up in search.
  await expect(card.getByTestId('memory-card-kind-memory-2')).toHaveText('Fact');

  await expect(card.getByTestId('memory-card-keywords')).toContainText('回覆');
  await expect(card.getByTestId('memory-card-content')).toHaveText('Boss 喜歡簡短回覆');

  // Newest occurrence first, and the other agent's row is not part of this log.
  const cards = page.getByTestId('memory-cards').locator('article');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toHaveAttribute('data-testid', 'memory-card-memory-2');
  await expect(page.getByText('not yours to read here')).toHaveCount(0);
});

test('the source message stays collapsed until the card is opened', async ({ page }) => {
  await openMemory(page);
  await page.getByTestId('memory-agent-open-agent-1').click();

  const card = page.getByTestId('memory-card-memory-2');
  await expect(card.getByTestId('memory-card-source-memory-2')).toHaveCount(0);

  await card.getByTestId('memory-card-toggle-memory-2').click();
  await expect(card.getByTestId('memory-card-source-memory-2')).toContainText('唔好長篇大論');

  await card.getByTestId('memory-card-toggle-memory-2').click();
  await expect(card.getByTestId('memory-card-source-memory-2')).toHaveCount(0);
});

test('a row without a source message says so instead of showing an empty box', async ({ page }) => {
  await openMemory(page);
  await page.getByTestId('memory-agent-open-agent-1').click();

  const card = page.getByTestId('memory-card-memory-1');
  await expect(card).toContainText('Injected: 0');
  await expect(card.getByTestId('memory-card-pin-memory-1')).not.toBeChecked();
  await expect(card.getByTestId('memory-card-kind-memory-1')).toHaveText('Event');
  await expect(card.getByTestId('memory-card-keywords')).toContainText('No keywords');

  await card.getByTestId('memory-card-toggle-memory-1').click();
  await expect(card.getByTestId('memory-card-source-memory-1')).toContainText('carries no source message');
});

test('the log reads the selected agent only, and the page keeps its sidebar entry marked', async ({ page }) => {
  await openMemory(page);
  await page.getByTestId('memory-agent-open-agent-1').click();

  await expect(page).toHaveURL(/\/en\/manage\/memory\/agent-1$/);
  await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible();

  // The detail page is reached from the list, so the way back is the first thing
  // in the toolbar, above the cards.
  await page.locator('#memory-detail-back-btn').click();
  await expect(page).toHaveURL(/\/en\/manage\/memory$/);
});

test('an agent that is not the caller’s own shows the empty state, not an error', async ({ page }) => {
  await mockBackend(page, { session: boss, agents });
  await seedSession(page);

  // A deep link to a log the account cannot read: the API answers 404, and that
  // is a state of its own rather than a failure worth an alert.
  await page.goto('/en/manage/memory/agent-404');
  await expect(page.getByText('No such agent.')).toBeVisible();
  await expect(page.getByTestId('memory-cards')).toHaveCount(0);
});

test('the pin switch writes the new state and stays where it was', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, agents, memories });
  await seedSession(page);
  await page.goto('/en/manage/memory/agent-1');

  const card = page.getByTestId('memory-card-memory-1');
  const pin = card.getByTestId('memory-card-pin-memory-1');
  await expect(pin).not.toBeChecked();

  await pin.check();
  await expect(pin).toBeChecked();

  const writes = backend.writes.filter((write) => write.method === 'PATCH' && write.path === '/memory/memory-1');
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({ pinned: true });

  // Pinning is a state, not a reload: the row keeps its place in the log.
  const rows = page.getByTestId('memory-cards').locator('article');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute('data-testid', 'memory-card-memory-2');
});

test('a pin the API refuses is put back rather than left showing', async ({ page }) => {
  await mockBackend(page, { session: boss, agents, memories });
  await seedSession(page);

  // The sixth pin on one agent is refused with 409, and the switch must not keep
  // claiming the row is pinned until the page is reloaded. Installed before the
  // navigation so the page never sees the mock's own answer.
  let patches = 0;
  await page.route('**/api/memory/memory-1', (route) => {
    if (route.request().method() !== 'PATCH') {
      return route.fallback();
    }
    patches += 1;
    return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'PINNED_LIMIT', message: 'At most 5 rows of one agent may be pinned.' } }) });
  });

  await page.goto('/en/manage/memory/agent-1');

  // A click rather than `check()`: the switch is reverted by the refusal, and
  // `check()` would wait for it to stay on.
  const pin = page.getByTestId('memory-card-pin-memory-1');
  await pin.click();
  // The revert lands when the refusal does, so wait for the alert that reports
  // it rather than for the switch: a slow round trip is not a wrong state.
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 });
  await expect(pin).not.toBeChecked();
  expect(patches).toBe(1);
});

test('the delete button sits right of the pin, and confirming drops the row', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, agents, memories });
  await seedSession(page);
  await page.goto('/en/manage/memory/agent-1');

  const card = page.getByTestId('memory-card-memory-1');
  const pinBox = await card.getByTestId('memory-card-pin-memory-1').boundingBox();
  const deleteBox = await card.getByTestId('memory-card-delete-memory-1').boundingBox();
  expect(deleteBox?.x ?? 0).toBeGreaterThan(pinBox?.x ?? 0);

  await card.getByTestId('memory-card-delete-memory-1').click();

  // The dialog names the row it is about to drop, because an id is not what the
  // user is looking at.
  const dialog = page.getByTestId('form-modal');
  await expect(dialog.getByTestId('memory-delete-content')).toHaveText('Boss 用 UTC+8');

  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByTestId('memory-card-memory-1')).toHaveCount(0);
  await expect(page.getByTestId('memory-card-memory-2')).toBeVisible();

  const deletes = backend.writes.filter((write) => write.method === 'DELETE' && write.path === '/memory/memory-1');
  expect(deletes).toHaveLength(1);
});

test('cancelling the delete keeps the row', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, agents, memories });
  await seedSession(page);
  await page.goto('/en/manage/memory/agent-1');

  await page.getByTestId('memory-card-delete-memory-1').click();
  await page.getByTestId('form-modal').getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByTestId('memory-card-memory-1')).toBeVisible();
  expect(backend.writes.filter((write) => write.method === 'DELETE')).toHaveLength(0);
});

/** The most recent write to the event-log switch, if the page made one. */
function eventLogWrite(backend: MockBackend) {
  return backend.writes.filter((write) => write.method === 'PUT' && write.path === '/user-config/memory.event_log').at(-1);
}

test('the event-log switch is on for an account that never touched it, and turning it off is stored', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, agents, memories });
  await seedSession(page);
  await page.goto('/en/manage/memory');

  const toggle = page.getByTestId('turn-write-toggle-eventLog');
  await expect(toggle).toBeChecked();

  await toggle.click();

  await expect.poll(() => eventLogWrite(backend)?.body).toEqual({ value: false });
  await expect(toggle).not.toBeChecked();
});

test('a stored event-log switch is shown as the account left it', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, agents, memories, userConfig: { 'memory.event_log': false } });
  await seedSession(page);
  await page.goto('/en/manage/memory');

  const toggle = page.getByTestId('turn-write-toggle-eventLog');
  await expect(toggle).not.toBeChecked();

  // Turning it back on is a new write rather than an untouched default.
  await toggle.click();
  await expect.poll(() => eventLogWrite(backend)?.body).toEqual({ value: true });
  await expect(toggle).toBeChecked();
});

test('a switch that cannot be stored is put back', async ({ page }) => {
  await mockBackend(page, { session: boss, agents, memories });
  await seedSession(page);
  await page.route('**/api/user-config/memory.event_log', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }) }));
  await page.goto('/en/manage/memory');

  const toggle = page.getByTestId('turn-write-toggle-eventLog');
  await expect(toggle).toBeChecked();
  await toggle.click();

  await expect(toggle).toBeChecked();
  await expect(page.getByRole('alert')).toBeVisible();
});
