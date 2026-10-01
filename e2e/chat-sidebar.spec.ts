import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockSession } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

const latest: MockSession = {
  id: 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee',
  title: 'Latest chat',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

const older: MockSession = {
  id: 'ffffffff-2222-4222-8222-ffffffffffff',
  title: 'Older chat',
  created_at: '2026-04-04T06:07:08Z',
  updated_at: '2026-04-05T06:07:08Z',
};

// Started by the app before the user named it, so it carries no title.
const untitled: MockSession = {
  id: '00000000-3333-4333-8333-000000000000',
  title: '',
  created_at: '2026-04-06T06:07:08Z',
  updated_at: '2026-04-06T06:07:08Z',
};

test('lists the chat sessions with the newest activity first', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [older, untitled, latest] });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  // The create action leads; the rest follow by activity, not by seed order.
  await expect(page.getByTestId('sidebar-chat-sessions').getByRole('link')).toHaveText(['New session', 'Latest chat', 'Untitled session', 'Older chat']);
});

test('marks the open chat and follows the selection', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [latest, older] });
  await seedSession(page);
  await page.goto(`/en/chat/${latest.id}`);
  await waitForShellStyles(page);

  const sessions = page.getByTestId('sidebar-chat-sessions');
  const active = sessions.locator('a.menu-active');
  await expect(active).toHaveText('Latest chat');

  // daisyUI only paints `.menu-active`, so the marker has to be visible paint.
  await expect.poll(() => active.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');

  await sessions.getByRole('link', { name: 'Older chat' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/chat/${older.id}$`));
  await expect(active).toHaveText('Older chat');
});

test('picks up a session started elsewhere without a reload', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, sessions: [latest] });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  const sessions = page.getByTestId('sidebar-chat-sessions');
  await expect(sessions.getByRole('link')).toHaveText(['New session', 'Latest chat']);

  // The sidebar polls, so a session created while the app is open shows up.
  backend.sessions.push(older);
  await expect(sessions.getByRole('link', { name: 'Older chat' })).toBeVisible({ timeout: 15000 });
});
