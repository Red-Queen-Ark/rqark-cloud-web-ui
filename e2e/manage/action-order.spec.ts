import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession } from '../support/mock-backend';
import { expectRowActions } from '../support/row-actions';

/**
 * The order every action column in the app follows: the action that only reads
 * first, the ones that change something next, the one that destroys last. A row
 * whose actions come out in another order reads as a different kind of row, and a
 * user who has learnt the list has to read every label again.
 */
const READ_FIRST = ['View', 'Edit', 'Delete'];

test('the agent, session and api-key lists order their actions the same way', async ({ page }) => {
  const backend = await mockBackend(page, {
    session: boss,
    agents: [{ id: 'agent-1', name: 'mine', description: '', created_at: '2026-04-05T06:07:08Z', owned: true }],
    sessions: [{ id: 'session-1', title: 'A session', created_at: '2026-04-05T06:07:08Z', updated_at: '2026-04-06T07:08:09Z' }],
    apiKeys: [
      {
        id: 'key-1',
        name: 'laptop',
        key_prefix: 'rqark-abc',
        is_active: true,
        expires_at: null,
        last_used_at: null,
        revoked_at: null,
        revoked_message: null,
        created_at: '2026-04-05T06:07:08Z',
      },
    ],
  });
  await seedSession(page);

  await page.goto('/en/manage/agents');
  await expectRowActions(page, page.getByRole('row').filter({ hasText: 'mine' }), READ_FIRST);

  await page.goto('/en/manage/sessions');
  await expectRowActions(page, page.getByRole('row').filter({ hasText: 'A session' }), READ_FIRST);

  // An API key cannot be read back — the list already carries every field worth
  // showing — so it starts at the write it does have.
  await page.goto('/en/manage/api-keys');
  await expectRowActions(page, page.getByRole('row').filter({ hasText: 'laptop' }), ['Edit', 'Delete']);

  expect(backend.requests.length).toBeGreaterThan(0);
});

test('a row the caller may not change offers only the read action', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    agents: [{ id: 'agent-2', name: 'shared', description: '', created_at: '2026-04-05T06:07:08Z', owned: false, is_public: true }],
  });
  await seedSession(page);

  await page.goto('/en/manage/agents');

  // One action is worth a button of its own rather than a menu behind a kebab.
  const row = page.getByRole('row').filter({ hasText: 'shared' });
  await expect(row.getByTestId('row-actions-button')).toHaveCount(0);
  await expectRowActions(page, row, ['View']);
});
