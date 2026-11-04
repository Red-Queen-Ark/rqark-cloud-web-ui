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

test('fills the create action while the home route is showing', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [latest, older] });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  const sessions = page.getByTestId('sidebar-chat-sessions');
  const create = sessions.locator('a.menu-active');
  await expect(create).toHaveText('New session');

  // daisyUI only paints `.menu-active`, so the marker has to be visible paint.
  await expect.poll(() => create.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');

  // Opening a session hands the one marker over to that row.
  await sessions.getByRole('link', { name: 'Latest chat' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/chat/${latest.id}$`));
  await expect(sessions.locator('a.menu-active')).toHaveText('Latest chat');
});

/** The alpha daisyUI parks in a computed colour, whatever notation the engine picks. */
function colorAlpha(color: string): number {
  const slash = color.lastIndexOf('/');
  if (slash !== -1) {
    return parseFloat(color.slice(slash + 1));
  }
  const parts = color.match(/[\d.]+/g) ?? [];
  return parts.length === 4 ? parseFloat(parts[3]) : 1;
}

test('keeps the row menu round and clear of the open chat fill', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [latest, older] });
  await seedSession(page);
  await page.goto(`/en/chat/${latest.id}`);
  await waitForShellStyles(page);

  const sessions = page.getByTestId('sidebar-chat-sessions');
  const openRow = sessions.locator('li').filter({ has: page.locator('a.menu-active') });
  const trigger = openRow.getByTestId('sidebar-chat-session-menu-button');
  const borderAtRest = await trigger.evaluate((el) => getComputedStyle(el).borderTopColor);

  await trigger.hover();

  // daisyUI paints every direct child of a menu `li` on hover, which squares off
  // the icon; the trigger's own circle is what should carry that paint.
  const overlay = openRow.locator('div.absolute');
  await expect.poll(() => overlay.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await expect.poll(() => trigger.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');

  const shape = await trigger.evaluate((el) => {
    const style = getComputedStyle(el);
    return { width: parseFloat(style.width), height: parseFloat(style.height), radius: parseFloat(style.borderTopLeftRadius) };
  });
  expect(shape.width).toBe(shape.height);
  expect(shape.radius).toBeGreaterThanOrEqual(shape.width / 2);

  // `btn-ghost` drops its transparent guards on hover, falling back to an opaque
  // base-200 for both the fill and the border. On this neutral-filled row the
  // fill reads as a solid light disc and the border as a hairline of the same
  // colour, so both have to stay translucent for the row's own colour to show.
  const hover = await trigger.evaluate((el) => {
    const style = getComputedStyle(el);
    return { fill: style.backgroundColor, border: style.borderTopColor };
  });
  const fillAlpha = colorAlpha(hover.fill);
  expect(fillAlpha).toBeLessThan(0.5);
  expect(fillAlpha).toBeGreaterThan(0);
  expect(hover.border).toBe(borderAtRest);
  expect(colorAlpha(hover.border)).toBe(0);

  // The open row is filled with `neutral`, so its icon has to follow the row's
  // own foreground rather than the base-content a plain row uses.
  const openColor = await trigger.evaluate((el) => getComputedStyle(el).color);
  const plainRow = sessions.locator('li').filter({ hasText: 'Older chat' });
  const plainColor = await plainRow.getByTestId('sidebar-chat-session-menu-button').evaluate((el) => getComputedStyle(el).color);
  expect(openColor).not.toBe(plainColor);
});

test('renames a session from its row menu', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, sessions: [latest, older] });
  await seedSession(page);
  await page.goto('/en');
  await waitForShellStyles(page);

  const sessions = page.getByTestId('sidebar-chat-sessions');
  const row = sessions.locator('li').filter({ hasText: 'Older chat' });

  await row.getByTestId('sidebar-chat-session-menu-button').click();
  // The menu is teleported to the body, so its items are page-level, not row-level.
  await page.getByTestId('sidebar-chat-session-menu').getByTestId('sidebar-chat-session-edit').click();
  await row.locator('input[type="text"]').fill('Renamed chat');
  await row.getByTestId('sidebar-chat-rename-save').click();

  await expect(sessions.getByRole('link', { name: 'Renamed chat' })).toBeVisible();
  expect(backend.writes.find((write) => write.method === 'PUT' && write.path === `/sessions/${older.id}`)?.body).toEqual({ title: 'Renamed chat' });
});

test('renames the session the header is naming', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [latest, older] });
  await seedSession(page);
  await page.goto(`/en/chat/${older.id}`);
  await waitForShellStyles(page);

  await expect(page.locator('header h1')).toHaveText('Older chat');

  const row = page.getByTestId('sidebar-chat-sessions').locator('li').filter({ hasText: 'Older chat' });
  await row.getByTestId('sidebar-chat-session-menu-button').click();
  // The menu is teleported to the body, so its items are page-level, not row-level.
  await page.getByTestId('sidebar-chat-session-menu').getByTestId('sidebar-chat-session-edit').click();
  await row.locator('input[type="text"]').fill('Renamed chat');
  await row.getByTestId('sidebar-chat-rename-save').click();

  await expect(page.locator('header h1')).toHaveText('Renamed chat');
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
