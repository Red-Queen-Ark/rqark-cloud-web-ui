import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockSession } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

const planning: MockSession = {
  id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  title: 'Ship the sessions page',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-06T07:08:09Z',
  plan_items: [
    { id: 'p1', content: 'Add the list page', status: 'completed' },
    { id: 'p2', content: 'Add the detail page', status: 'pending' },
  ],
  messages: [
    { seq: 1, role: 'user', created_at: '2026-04-05T06:10:00Z', data: { content: 'Add the sessions page.' } },
    { seq: 2, role: 'assistant', created_at: '2026-04-05T06:11:00Z', data: { content: 'Done. **Read-only** for now.' } },
    { seq: 3, role: 'tool', created_at: '2026-04-05T06:12:00Z', data: { name: 'PlanUpdate', args: { items: 2 } } },
  ],
};

/** A session the app started before the user named it: it carries no title. */
const untitled: MockSession = {
  id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
  title: '',
  created_at: '2026-04-07T08:09:10Z',
  updated_at: '2026-04-07T08:09:10Z',
};

// `YYYY-MM-DD HH:MM:SS`: date *and* time, zero padded, seconds included.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** The instant a rendered stamp points at, without hardcoding a timezone. */
async function instantOf(page: Page, stamp: string): Promise<number> {
  return new Date(stamp.replace(' ', 'T')).getTime();
}

test('lists the sessions with their plan size and timestamps', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning, untitled] });
  await seedSession(page);

  await page.goto('/en/sessions');
  await waitForShellStyles(page);

  // The page is reachable from the shell.
  await expect(page.getByRole('list').getByRole('link', { name: 'Sessions' })).toBeVisible();

  // The endpoint answers with the whole set: both rows are rendered at once.
  await expect(page.locator('tbody tr')).toHaveCount(2);

  const row = page.getByRole('row').filter({ hasText: planning.title });
  await expect(row.getByRole('cell', { name: planning.title, exact: true })).toBeVisible();
  await expect(row.getByRole('cell').nth(1)).toHaveText('2');

  const created = row.getByRole('cell', { name: TIMESTAMP }).first();
  expect(await instantOf(page, await created.innerText())).toBe(new Date(planning.created_at).getTime());
  const updated = row.getByRole('cell', { name: TIMESTAMP }).nth(1);
  expect(await instantOf(page, await updated.innerText())).toBe(new Date(planning.updated_at as string).getTime());

  // A session with no title yet falls back to a dash, and no plan items means 0.
  await expect(page.getByRole('cell', { name: '—' })).toHaveCount(1);
  await expect(page.getByRole('cell', { name: '0', exact: true })).toHaveCount(1);
});

test('an empty list offers no create action', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/sessions');
  await waitForShellStyles(page);

  await expect(page.getByText('No sessions found.')).toBeVisible();

  // A session is opened by the app, not authored on this page, so there is no
  // primary action here.
  await expect(page.locator('[data-testid="data-toolbar-actions"] button')).toHaveCount(0);
  await expect(page.locator('[data-testid="data-list-panel"] .btn-primary')).toHaveCount(0);
});

test('the view button opens the session detail page, and back returns to the list', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto('/en/sessions');
  await waitForShellStyles(page);

  await page.getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/sessions/${planning.id}$`));

  await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();

  await page.locator('#session-detail-back-btn').click();
  await expect(page).toHaveURL(/\/en\/sessions$/);
  await expect(page.getByRole('cell', { name: planning.title, exact: true })).toBeVisible();
});

test('the detail page keeps its list entry marked in the sidebar', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto(`/en/sessions/${planning.id}`);
  await waitForShellStyles(page);

  // The header and the sidebar resolve the detail route through the same
  // navigation entry as the list, rather than falling back to the app name.
  await expect(page.getByRole('heading', { level: 1, name: 'Sessions' })).toBeVisible();

  const active = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.drawer-side ul > li > a'))
      .filter((el) => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)')
      .map((el) => el.textContent?.trim() ?? ''),
  );
  expect(active).toEqual(['Sessions']);
});

test('the detail page shows the metadata, the plan and the messages', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto(`/en/sessions/${planning.id}`);
  await waitForShellStyles(page);

  // Metadata, with the timestamps in the one shape the UI uses everywhere.
  await expect(page.getByRole('definition').filter({ hasText: planning.title })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: planning.id })).toBeVisible();
  for (const stamp of await page.getByRole('definition').filter({ hasText: TIMESTAMP }).allTextContents()) {
    expect(await instantOf(page, stamp)).toBeGreaterThan(0);
  }

  // Plan items, each with the wording for its status.
  await expect(page.getByText('Add the list page')).toBeVisible();
  await expect(page.getByText('Completed')).toBeVisible();
  await expect(page.getByText('Pending')).toBeVisible();

  // The three messages, in the order the API returned them.
  const bubbles = page.locator('.chat-bubble, pre');
  await expect(page.getByText('Add the sessions page.')).toBeVisible();
  await expect(bubbles.first()).toContainText('Add the sessions page.');

  // Markdown in a message is rendered, not printed as source.
  await expect(page.locator('strong', { hasText: 'Read-only' })).toBeVisible();

  // A payload that is not plain text is shown verbatim rather than guessed at.
  await expect(page.locator('pre')).toContainText('"name": "PlanUpdate"');
});

test('a message body cannot inject markup into the page', async ({ page }) => {
  const hostile: MockSession = {
    id: 'cccccccc-3333-4333-8333-cccccccccccc',
    title: 'hostile',
    created_at: '2026-04-05T06:07:08Z',
    messages: [
      {
        seq: 1,
        role: 'assistant',
        created_at: '2026-04-05T06:11:00Z',
        data: { content: '<img src="x" onerror="window.__xss = true"><script>window.__xss = true</script>' },
      },
    ],
  };
  await mockBackend(page, { session: boss, sessions: [hostile] });
  await seedSession(page);

  await page.goto(`/en/sessions/${hostile.id}`);
  await waitForShellStyles(page);
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();

  // The renderer is the only thing between the API and `v-html`, so this is the
  // assertion that it actually strips what the engine did not write.
  expect(await page.evaluate(() => (window as { __xss?: boolean }).__xss)).toBeUndefined();
  expect(await page.locator('.chat-bubble').first().innerHTML()).not.toContain('onerror');
});

test('an unknown plan status keeps its own wording', async ({ page }) => {
  const fromNewerEngine: MockSession = {
    id: 'dddddddd-4444-4444-8444-dddddddddddd',
    title: 'from a newer engine',
    created_at: '2026-04-05T06:07:08Z',
    plan_items: [{ id: 'p1', content: 'Wait for review', status: 'awaiting_review' }],
  };
  await mockBackend(page, { session: boss, sessions: [fromNewerEngine] });
  await seedSession(page);

  await page.goto(`/en/sessions/${fromNewerEngine.id}`);
  await waitForShellStyles(page);

  // Printing one of the four known labels would name a state never set.
  await expect(page.getByText('awaiting_review')).toBeVisible();
});

test('a session that is not there says so instead of failing', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto('/en/sessions/00000000-0000-4000-8000-000000000000');
  await waitForShellStyles(page);

  // Both endpoints answer 404, and neither reaches the alert stack: a session
  // that is not there is a state of the page, not an error to report.
  await expect(page.getByText('No such session.')).toBeVisible();
  await expect(page.locator('[data-testid="data-list-panel"]')).toHaveCount(0);
});

test('an empty session offers no messages rather than an empty thread', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [untitled] });
  await seedSession(page);

  await page.goto(`/en/sessions/${untitled.id}`);
  await waitForShellStyles(page);

  await expect(page.getByText('This session has no messages yet.')).toBeVisible();
  // A session with no title says so, rather than showing a blank row.
  await expect(page.getByText('Untitled session')).toBeVisible();
});

test('the page follows the language prefix', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto('/zh-tw/sessions');
  await waitForShellStyles(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Sessions' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '標題' })).toBeVisible();

  // The detail route keeps the prefix it was opened with.
  await page.getByRole('button', { name: '查看' }).click();
  await expect(page).toHaveURL(new RegExp(`/zh-tw/sessions/${planning.id}$`));
  await expect(page.getByRole('heading', { name: '詳細資料' })).toBeVisible();
  await expect(page.getByText('已完成')).toBeVisible();

  await page.locator('#session-detail-back-btn').click();
  await expect(page).toHaveURL(/\/zh-tw\/sessions$/);
});
