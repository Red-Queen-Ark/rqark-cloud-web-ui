import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockBackend, type MockSession, type MockWrite } from '../support/mock-backend';
import { openRowActions } from '../support/row-actions';
import { waitForShellStyles } from '../support/styles';

// The engine's own shapes, as `rqark-core` writes them: a user turn is a list of
// parts, an assistant turn is its answer plus whatever it thought and called,
// and a tool result is a separate entry pointing back at the call it answers.
const planning: MockSession = {
  id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  title: 'Ship the sessions page',
  source: 'TUI',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-06T07:08:09Z',
  plan_items: [
    { id: 'p1', content: 'Add the list page', status: 'completed' },
    { id: 'p2', content: 'Add the detail page', status: 'pending' },
  ],
  messages: [
    {
      seq: 0,
      role: 'user',
      created_at: '2026-04-05T06:10:00Z',
      data: { role: 'user', content: [{ type: 'text', text: 'Add the sessions page.' }], created_at: '2026-04-05T06:10:00Z' },
    },
    {
      seq: 1,
      role: 'assistant',
      created_at: '2026-04-05T06:11:00Z',
      data: { role: 'assistant', content: 'Done. **Read-only** for now.', reasoning_content: 'It only has to read.', created_at: '2026-04-05T06:11:00Z' },
    },
    {
      seq: 2,
      role: 'assistant',
      created_at: '2026-04-05T06:12:00Z',
      data: {
        role: 'assistant',
        content: '',
        created_at: '2026-04-05T06:12:00Z',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'plan_update', arguments: '{"items":[{"id":"p1","content":"Add the list page","status":"completed"}]}' } }],
      },
    },
    {
      seq: 3,
      role: 'tool',
      created_at: '2026-04-05T06:12:01Z',
      data: { role: 'tool', tool_call_id: 'call_1', content: 'plan updated', created_at: '2026-04-05T06:12:01Z' },
    },
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

/** The last write the page sent to the sessions resource with that method. */
function lastWrite(backend: MockBackend, method: string): MockWrite | undefined {
  return backend.writes.filter((write) => write.method === method && write.path.startsWith('/sessions')).at(-1);
}

test('lists the sessions with their source, plan size and timestamps', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning, untitled] });
  await seedSession(page);

  await page.goto('/en/manage/sessions');
  await waitForShellStyles(page);

  // The page is reachable from the shell.
  await expect(page.getByRole('list').getByRole('link', { name: 'Sessions' })).toBeVisible();

  // The endpoint answers with the whole set: both rows are rendered at once.
  await expect(page.locator('tbody tr')).toHaveCount(2);

  const row = page.getByRole('row').filter({ hasText: planning.title });
  await expect(row.getByRole('cell', { name: planning.title, exact: true })).toBeVisible();
  await expect(row.getByRole('cell').nth(1)).toHaveText('TUI');
  await expect(row.getByRole('cell').nth(2)).toHaveText('2');

  const created = row.getByRole('cell', { name: TIMESTAMP }).first();
  expect(await instantOf(page, await created.innerText())).toBe(new Date(planning.created_at).getTime());
  const updated = row.getByRole('cell', { name: TIMESTAMP }).nth(1);
  expect(await instantOf(page, await updated.innerText())).toBe(new Date(planning.updated_at as string).getTime());

  // A session with no title yet falls back to a dash, and so does a source one
  // of them never set; no plan items means 0.
  const bare = page.getByRole('row').filter({ hasText: '—' });
  await expect(bare.getByRole('cell').nth(0)).toHaveText('—');
  await expect(bare.getByRole('cell').nth(1)).toHaveText('—');
  await expect(page.getByRole('cell', { name: '0', exact: true })).toHaveCount(1);
});

test('an empty list offers no create action', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en/manage/sessions');
  await waitForShellStyles(page);

  await expect(page.getByText('No sessions found.')).toBeVisible();

  // A session is opened by the app, not authored on this page, so there is no
  // primary action here.
  await expect(page.locator('[data-testid="data-toolbar-actions"] button')).toHaveCount(0);
  await expect(page.locator('[data-testid="data-list-panel"] .btn-primary')).toHaveCount(0);
});

test('the edit dialog rewrites the title and the source', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto('/en/manage/sessions');
  await waitForShellStyles(page);

  const menu = await openRowActions(page, page.getByRole('row').filter({ hasText: planning.title }));
  await menu.getByRole('button', { name: 'Edit' }).click();

  // Prefilled with what the session holds, the source included.
  await expect(page.locator('#session-form-title')).toHaveValue(planning.title);
  await expect(page.locator('#session-form-source')).toHaveValue('TUI');

  await page.locator('#session-form-title').fill('Ship the sessions page properly');
  await page.locator('#session-form-source').selectOption('AGENT_CLOUD');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(0);

  const write = lastWrite(backend, 'PUT');
  expect(write?.path).toBe(`/sessions/${planning.id}`);
  expect(write?.body).toEqual({ title: 'Ship the sessions page properly', source: 'AGENT_CLOUD' });

  // The list is read back, so the row shows what was stored.
  const row = page.getByRole('row').filter({ hasText: 'Ship the sessions page properly' });
  await expect(row.getByRole('cell').nth(1)).toHaveText('AGENT_CLOUD');
});

test('the source picker takes a name this build has never heard of', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, sessions: [untitled] });
  await seedSession(page);

  await page.goto('/en/manage/sessions');
  await waitForShellStyles(page);

  const menu = await openRowActions(page, page.getByRole('row').filter({ hasText: '—' }));
  await menu.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#session-form-source').selectOption({ label: 'Other' });

  // The free-text field only exists once that choice is made.
  await expect(page.locator('#session-form-custom-source')).toBeVisible();
  await page.locator('#session-form-custom-source').fill('VOICE');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();

  expect(lastWrite(backend, 'PUT')?.body).toEqual({ title: '', source: 'VOICE' });
  await expect(page.getByRole('row').filter({ hasText: '—' }).getByRole('cell').nth(1)).toHaveText('VOICE');
});

test('a source this build does not know opens as free text, unchanged', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, sessions: [{ ...planning, source: 'VOICE' }] });
  await seedSession(page);

  await page.goto('/en/manage/sessions');
  await waitForShellStyles(page);

  // The table prints whatever is stored, without mapping it onto a known name.
  await expect(page.getByRole('row').filter({ hasText: planning.title }).getByRole('cell').nth(1)).toHaveText('VOICE');

  const menu = await openRowActions(page, page.getByRole('row').filter({ hasText: planning.title }));
  await menu.getByRole('button', { name: 'Edit' }).click();

  // It lands on the free-text row rather than on one of the known ones: the
  // field is there, holding the source, which is what "not a known one" means.
  await expect(page.locator('#session-form-custom-source')).toHaveValue('VOICE');

  // Saving it untouched writes the same source back.
  await page.locator('[data-testid="form-modal"] .btn-primary').click();
  expect(lastWrite(backend, 'PUT')?.body).toEqual({ title: planning.title, source: 'VOICE' });
});

test('the free-text source cannot be left empty', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto('/en/manage/sessions');
  await waitForShellStyles(page);

  const menu = await openRowActions(page, page.getByRole('row').filter({ hasText: planning.title }));
  await menu.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#session-form-source').selectOption({ label: 'Other' });
  await page.locator('#session-form-custom-source').fill('   ');
  await page.locator('[data-testid="form-modal"] .btn-primary').click();

  // "None" is the row for an empty source, so a blank free-text field is a
  // mistake worth naming rather than a write of the empty string.
  await expect(page.getByText('Please type a source name')).toBeVisible();
  await expect(page.locator('[data-testid="form-modal"]')).toHaveCount(1);
  expect(lastWrite(backend, 'PUT')).toBeUndefined();
});

test('the back link sits left of the heading', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);
  await page.goto(`/en/manage/sessions/${planning.id}`);

  const back = await page.locator('#session-detail-back-btn').boundingBox();
  const title = await page.locator('[data-testid="data-toolbar"] p').first().boundingBox();
  expect(back && title && back.x < title.x).toBe(true);
});

test('the view button opens the session detail page, and back returns to the list', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto('/en/manage/sessions');
  await waitForShellStyles(page);

  const menu = await openRowActions(page, page.getByRole('row').filter({ hasText: planning.title }));
  await menu.getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/manage/sessions/${planning.id}$`));

  // The toolbar names the session being viewed, so the page says what it is
  // showing without a heading of its own.
  await expect(page.locator('[data-testid="data-toolbar"]')).toContainText(planning.title);

  await page.locator('#session-detail-back-btn').click();
  await expect(page).toHaveURL(/\/en\/manage\/sessions$/);
  await expect(page.getByRole('cell', { name: planning.title, exact: true })).toBeVisible();
});

test('the detail page keeps its list entry marked in the sidebar', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto(`/en/manage/sessions/${planning.id}`);
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

test('the detail page shows the session as a chat transcript', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto(`/en/manage/sessions/${planning.id}`);
  await waitForShellStyles(page);

  // The toolbar carries the session's identity, with the timestamps in the one
  // shape the UI uses everywhere.
  const toolbar = page.locator('[data-testid="data-toolbar"]');
  await expect(toolbar).toContainText(planning.title);
  await expect(toolbar).toContainText(planning.id);
  for (const stamp of (await toolbar.innerText()).match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g) ?? []) {
    expect(await instantOf(page, stamp)).toBeGreaterThan(0);
  }

  // The plan leads the transcript, the way it leads a live chat.
  const plan = page.getByTestId('chat-plan-card');
  await expect(plan).toContainText('Add the list page');
  await expect(plan).toContainText('Completed');
  await expect(plan).toContainText('Add the detail page');
  await expect(plan).toContainText('Pending');
  await expect(page.getByTestId('chat-plan-footer')).toHaveText('2 items · 1 completed · 1 pending');

  // The user's own words sit in a bubble of their own, on their own side.
  const userBubble = page.getByTestId('user-message');
  await expect(userBubble).toHaveCount(1);
  await expect(userBubble).toContainText('Add the sessions page.');

  // Markdown in an answer is rendered, not printed as source, and the thinking
  // that came with it folds away behind its own title.
  await expect(page.locator('strong', { hasText: 'Read-only' })).toBeVisible();
  const think = page.getByTestId('think-block');
  await expect(think).toContainText('It only has to read.');

  // The tool call is named, carries the gist of its arguments, and shows the
  // result the session stored next to it.
  const toolCall = page.getByTestId('turn-activity-1');
  await toolCall.locator('summary').first().click();
  await expect(toolCall).toContainText('✅ Add the list page');
  await expect(toolCall).toContainText('plan updated');
  await expect(page.getByTestId('tool-status-call_1').locator('.text-success')).toBeVisible();
  await expect(page.getByTestId('tool-detail-call_1')).toHaveText('✅ Add the list page');
});

test('the rendered markdown is styled, not left to the browser defaults', async ({ page }) => {
  const formatted: MockSession = {
    id: 'ffffffff-6666-4666-8666-ffffffffffff',
    title: 'formatted',
    created_at: '2026-04-05T06:07:08Z',
    messages: [
      {
        seq: 0,
        role: 'assistant',
        created_at: '2026-04-05T06:11:00Z',
        data: { role: 'assistant', content: '## Heading\n\n```ts\nconst a = 1;\n```', created_at: '2026-04-05T06:11:00Z' },
      },
    ],
  };
  await mockBackend(page, { session: boss, sessions: [formatted] });
  await seedSession(page);

  await page.goto(`/en/manage/sessions/${formatted.id}`);
  await waitForShellStyles(page);

  // The markdown stylesheet, not the component's own `text-sm`, wins here: a
  // transcript rendered without it reads as a slab of unstyled text.
  const body = page.locator('.markdown-body');
  await expect(body).toHaveCSS('font-size', '16px');

  // A fenced block is given the pane background rather than the browser's.
  const code = body.locator('pre');
  await expect(code).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(code).toHaveCSS('border-radius', '8px');
});

test('a message the components have no shape for is dropped, not crashed on', async ({ page }) => {
  const fromNewerEngine: MockSession = {
    id: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee',
    title: 'from a newer engine',
    created_at: '2026-04-05T06:07:08Z',
    messages: [
      { seq: 0, role: 'user', created_at: '2026-04-05T06:10:00Z', data: { role: 'user', content: [{ type: 'text', text: 'still here' }], created_at: '2026-04-05T06:10:00Z' } },
      { seq: 1, role: 'widget', created_at: '2026-04-05T06:11:00Z', data: { role: 'widget', payload: { level: 3 } } },
    ],
  };
  await mockBackend(page, { session: boss, sessions: [fromNewerEngine] });
  await seedSession(page);

  await page.goto(`/en/manage/sessions/${fromNewerEngine.id}`);
  await waitForShellStyles(page);

  // The chat components render the four roles the engine writes and pass over
  // anything else, so a session from a newer engine still shows what it can.
  await expect(page.getByTestId('session-history')).toContainText('still here');
  await expect(page.getByTestId('session-history')).not.toContainText('widget');
});

test('a message body cannot inject markup into the page', async ({ page }) => {
  const hostile: MockSession = {
    id: 'cccccccc-3333-4333-8333-cccccccccccc',
    title: 'hostile',
    created_at: '2026-04-05T06:07:08Z',
    messages: [
      {
        seq: 0,
        role: 'assistant',
        created_at: '2026-04-05T06:11:00Z',
        data: { role: 'assistant', content: '<img src="x" onerror="window.__xss = true"><script>window.__xss = true</script>', created_at: '2026-04-05T06:11:00Z' },
      },
    ],
  };
  await mockBackend(page, { session: boss, sessions: [hostile] });
  await seedSession(page);

  await page.goto(`/en/manage/sessions/${hostile.id}`);
  await waitForShellStyles(page);
  await expect(page.locator('.markdown-body').first()).toBeVisible();

  // The renderer is the only thing between the API and `v-html`, so this is the
  // assertion that it actually strips what the engine did not write.
  expect(await page.evaluate(() => (window as { __xss?: boolean }).__xss)).toBeUndefined();
  expect(await page.locator('.markdown-body').first().innerHTML()).not.toContain('onerror');
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

  await page.goto(`/en/manage/sessions/${fromNewerEngine.id}`);
  await waitForShellStyles(page);

  // Printing one of the four known labels would name a state never set.
  await expect(page.getByText('awaiting_review')).toBeVisible();
});

test('a session that is not there says so instead of failing', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto('/en/manage/sessions/00000000-0000-4000-8000-000000000000');
  await waitForShellStyles(page);

  // Both endpoints answer 404, and neither reaches the alert stack: a session
  // that is not there is a state of the page, not an error to report.
  await expect(page.getByText('No such session.')).toBeVisible();
  await expect(page.locator('[data-testid="data-list-panel"]')).toHaveCount(0);
});

test('an empty session offers no messages rather than an empty thread', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [untitled] });
  await seedSession(page);

  await page.goto(`/en/manage/sessions/${untitled.id}`);
  await waitForShellStyles(page);

  await expect(page.getByText('This session has no messages yet.')).toBeVisible();
  // A session with no title says so, rather than showing a blank row.
  await expect(page.getByText('Untitled session')).toBeVisible();
});

test('the page follows the language prefix', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);

  await page.goto('/zh-tw/manage/sessions');
  await waitForShellStyles(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Sessions' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '標題' })).toBeVisible();

  // The detail route keeps the prefix it was opened with.
  const menu = await openRowActions(page, page.getByRole('row').filter({ hasText: planning.title }));
  await menu.getByRole('button', { name: '查看' }).click();
  await expect(page).toHaveURL(new RegExp(`/zh-tw/manage/sessions/${planning.id}$`));
  await expect(page.locator('[data-testid="data-toolbar"]')).toContainText(planning.title);
  await expect(page.getByTestId('chat-plan-card')).toContainText('已完成');

  await page.locator('#session-detail-back-btn').click();
  await expect(page).toHaveURL(/\/zh-tw\/manage\/sessions$/);
});

test('the plan floats above the transcript and stays put while it scrolls', async ({ page }) => {
  const messages = Array.from({ length: 40 }, (_, index) => ({
    seq: index,
    role: index % 2 === 0 ? 'user' : 'assistant',
    created_at: '2026-04-05T06:10:00Z',
    data: index % 2 === 0 ? { role: 'user', content: [{ type: 'text', text: `message ${index}` }], created_at: '2026-04-05T06:10:00Z' } : { role: 'assistant', content: `reply ${index}`, created_at: '2026-04-05T06:10:00Z' },
  }));
  const long: MockSession = {
    id: 'aaaa4444-1111-4111-8111-aaaaaaaaaaaa',
    title: 'A long session',
    created_at: '2026-04-05T06:07:08Z',
    updated_at: '2026-04-06T07:08:09Z',
    plan_items: [{ id: 'p1', content: 'Draft the plan', status: 'in_progress' }],
    messages,
  };
  await mockBackend(page, { session: boss, sessions: [long] });
  await seedSession(page);

  await page.goto(`/en/manage/sessions/${long.id}`);
  await waitForShellStyles(page);

  const card = page.getByTestId('chat-plan-card');
  await expect(card).toBeVisible();

  // The plan lives in its own dock, not in the scrolling history.
  await expect(page.locator('[data-testid="session-history"] [data-testid="chat-plan-card"]')).toHaveCount(0);
  await expect(page.getByTestId('session-plan-dock')).toHaveCSS('position', 'sticky');

  const before = await card.boundingBox();
  expect(before).not.toBeNull();

  await page.locator('#app-scroll').evaluate((el) => {
    el.scrollTop = 300;
  });
  await page.waitForTimeout(100);
  const pinned = await card.boundingBox();

  await page.locator('#app-scroll').evaluate((el) => {
    el.scrollTop += 400;
  });
  await page.waitForTimeout(100);
  const pinnedLater = await card.boundingBox();

  // It moves up until it pins, then holds its place rather than scrolling away
  // with the transcript.
  expect(pinned?.y ?? 0).toBeLessThan(before?.y ?? 0);
  expect(Math.abs((pinnedLater?.y ?? 0) - (pinned?.y ?? 0))).toBeLessThan(2);
});

test('deletes a session after confirming, and keeps the confirmation from firing twice', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, sessions: [planning, untitled] });
  await seedSession(page);
  await page.goto('/en/manage/sessions');

  const row = page.getByTestId('session-row-aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
  const menu = await openRowActions(page, row);
  await menu.getByRole('button', { name: 'Delete' }).click();

  const dialog = page.getByTestId('form-modal');
  await expect(dialog).toContainText('Ship the sessions page');
  await expect(dialog).toContainText('TUI');

  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByTestId('session-row-aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')).toHaveCount(0);
  await expect(page.getByTestId('session-row-bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb')).toBeVisible();

  const deletes = backend.writes.filter((write) => write.method === 'DELETE' && write.path === '/sessions/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
  expect(deletes).toHaveLength(1);
});

test('cancelling the confirmation keeps the session', async ({ page }) => {
  const backend = await mockBackend(page, { session: boss, sessions: [planning] });
  await seedSession(page);
  await page.goto('/en/manage/sessions');

  const menu = await openRowActions(page, page.getByTestId('session-row-aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'));
  await menu.getByRole('button', { name: 'Delete' }).click();
  await page.getByTestId('form-modal').getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByTestId('form-modal')).toHaveCount(0);
  await expect(page.getByTestId('session-row-aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')).toBeVisible();
  expect(backend.writes.some((write) => write.method === 'DELETE')).toBe(false);
});

test('an untitled session is named sensibly in the confirmation', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [untitled] });
  await seedSession(page);
  await page.goto('/en/manage/sessions');

  const menu = await openRowActions(page, page.getByTestId('session-row-bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'));
  await menu.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByTestId('form-modal')).toContainText('Untitled session');
});
