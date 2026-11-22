import { expect, test, type Locator, type Page, type WebSocketRoute } from '@playwright/test';
import { boss, jwtExpiringIn, mockBackend, seedSession, type MockAgent, type MockProvider, type MockSession, type MockSessionMessage } from './support/mock-backend';
import { waitForShellStyles } from './support/styles';

const first: MockSession = {
  id: 'cccccccc-1111-4111-8111-cccccccccccc',
  title: 'First chat',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

const second: MockSession = {
  id: 'dddddddd-2222-4222-8222-dddddddddddd',
  title: 'Second chat',
  created_at: '2026-04-04T06:07:08Z',
  updated_at: '2026-04-05T06:07:08Z',
};

function socketPath(url: string): string {
  return new URL(url).pathname;
}

const SOCKET_PREFIX = '/agent-api/chat/ws/';

const turnTimestamp = '2026-05-06T07:08:09Z';

const agent: MockAgent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };

const provider: MockProvider = { id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' };

function frame(payload: unknown): string {
  return JSON.stringify({ agent_id: 'researcher:session', path: [], payload });
}

async function openTurn(page: Page, session: MockSession): Promise<{ socket: WebSocketRoute; history: Locator }> {
  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider] });
  await seedSession(page);

  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    socket = ws;
  });

  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
  await expect.poll(() => socket !== undefined).toBe(true);

  const input = page.getByTestId('chat-input');
  await expect(input).toBeEnabled();
  await input.fill('hello there');
  await page.getByTestId('chat-send').click();

  return { socket: socket as WebSocketRoute, history: page.locator('#chat-history') };
}

test('opens the socket of the session in the url', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first, second] });
  await seedSession(page);

  const opened: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    opened.push(ws.url());
  });

  await page.goto(`/en/chat/${first.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();

  await expect.poll(() => opened.map(socketPath)).toEqual([`${SOCKET_PREFIX}${first.id}`]);
  expect(new URL(opened[0]).searchParams.get('token')).toBe('access-token-1');
});

test('moves to the socket of the session it switches to', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first, second] });
  await seedSession(page);

  const opened: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    opened.push(ws.url());
  });

  await page.goto(`/en/chat/${first.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
  await expect.poll(() => opened.length).toBe(1);

  const sessions = page.getByTestId('sidebar-chat-sessions');
  await sessions.getByRole('link', { name: 'Second chat' }).click();

  await expect(page).toHaveURL(new RegExp(`/en/chat/${second.id}$`));
  await expect.poll(() => opened.map(socketPath)).toEqual([`${SOCKET_PREFIX}${first.id}`, `${SOCKET_PREFIX}${second.id}`]);
});

test('keeps a draft per session across a switch and a reload', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first, second], agents: [agent], providers: [provider] });
  await seedSession(page);
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);

  await page.goto(`/en/chat/${first.id}`);
  const input = page.getByTestId('chat-input');
  await expect(input).toBeEnabled();
  await input.fill('draft for the first chat');

  const sessions = page.getByTestId('sidebar-chat-sessions');
  await sessions.getByRole('link', { name: 'Second chat' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/chat/${second.id}$`));
  await expect(input).toBeEmpty();

  await input.fill('draft for the second chat');
  await sessions.getByRole('link', { name: 'First chat' }).click();
  await expect(input).toHaveText('draft for the first chat');

  await page.reload();

  await expect(input).toHaveText('draft for the first chat');
  await sessions.getByRole('link', { name: 'Second chat' }).click();
  await expect(input).toHaveText('draft for the second chat');
});

test('names the open session in the header', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first, second] });
  await seedSession(page);

  await page.goto(`/en/chat/${first.id}`);
  await waitForShellStyles(page);

  await expect(page.locator('header h1')).toHaveText('First chat');

  await page.getByTestId('sidebar-chat-sessions').getByRole('link', { name: 'Second chat' }).click();

  await expect(page.locator('header h1')).toHaveText('Second chat');
});

test('sends what was typed as the turn the agent cloud resolves', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    sessions: [first, second],
    agents: [{ id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' }],
    providers: [{ id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' }],
  });
  await seedSession(page);

  const sent: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    ws.onMessage((message) => sent.push(String(message)));
  });

  await page.goto(`/en/chat/${first.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();

  const input = page.getByTestId('chat-input');
  await expect(input).toBeEnabled();
  await input.fill('hello there');
  await page.getByTestId('chat-send').click();

  await expect.poll(() => sent).toEqual([JSON.stringify({ content: 'hello there', provider: 'openai', agent: 'researcher' })]);
  await expect(input).toBeEmpty();
});

test('sends an attached image with the turn', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first], agents: [agent], providers: [provider] });
  await seedSession(page);

  const sent: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    ws.onMessage((message) => sent.push(String(message)));
  });

  await page.goto(`/en/chat/${first.id}`);
  await expect(page.getByTestId('chat-input')).toBeEnabled();

  // A one-pixel PNG is enough: the browser turns it into the same data URI the
  // terminal client sends, and the frame only has to carry it through.
  await page.getByTestId('chat-image-input').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  });

  await expect(page.getByTestId('chat-image-remove')).toHaveCount(1);
  await page.getByTestId('chat-send').click();

  await expect.poll(() => sent.length).toBe(1);
  const frame = JSON.parse(sent[0]) as { images: string[] };
  expect(frame.images).toHaveLength(1);
  expect(frame.images[0]).toMatch(/^data:image\/png;base64,/);
});

test('sends a turn typed after the socket dropped, once it is back', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first], agents: [agent], providers: [provider] });
  await seedSession(page);

  const sockets: WebSocketRoute[] = [];
  const sent: string[][] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    const received: string[] = [];
    sent.push(received);
    sockets.push(ws);
    ws.onMessage((message) => received.push(String(message)));
  });

  await page.goto(`/en/chat/${first.id}`);
  await expect(page.getByTestId('chat-status')).toHaveClass(/status-success/);

  sockets[0].close();

  const input = page.getByTestId('chat-input');
  await input.fill('hello there');
  await page.getByTestId('chat-send').click();

  await expect.poll(() => sent.length).toBe(2);
  await expect.poll(() => sent[1]).toEqual([JSON.stringify({ content: 'hello there', provider: 'openai', agent: 'researcher' })]);
  await expect(input).toBeEmpty();
});

test('shows the turn and the answer as the agent streams them', async ({ page }) => {
  const { socket, history } = await openTurn(page, first);

  socket.send(frame({ role: 'user', content: [{ type: 'text', text: 'hello there' }], created_at: turnTimestamp }));
  await expect(history).toContainText('hello there');

  socket.send(frame({ type: 'content', content: 'It is ' }));
  await expect(history).toContainText('It is');

  socket.send(frame({ type: 'content', content: 'sunny.' }));
  await expect(history).toContainText('It is sunny.');

  socket.send(frame({ role: 'assistant', content: 'It is sunny.', created_at: turnTimestamp }));
  await expect(history).toContainText('It is sunny.');
});

test('shows the reasoning the agent streamed, folded into its own block', async ({ page }) => {
  const { socket, history } = await openTurn(page, first);

  socket.send(frame({ type: 'reasoning_content', content: 'Let me check the sky.' }));

  // Reasoning is always kept, but it is the least re-read part of a turn, so it
  // sits behind its own disclosure rather than in the answer's way.
  const think = history.getByTestId('think-block');
  await expect(think).toContainText('Let me check the sky.');
  await expect(think).not.toHaveAttribute('open', '');
  await expect(think.locator('.collapse-content')).toBeHidden();

  await think.locator('summary').click();
  await expect(think).toHaveAttribute('open', '');
  await expect(think.locator('.collapse-content')).toBeVisible();
});

test('shows the tool calls the agent made and the result of each', async ({ page }) => {
  const { socket, history } = await openTurn(page, first);

  socket.send(frame({ type: 'content', content: 'Checking.' }));
  socket.send(
    frame({
      role: 'assistant',
      content: 'Checking.',
      created_at: turnTimestamp,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'plan_update', arguments: '{}' } }],
    }),
  );
  await expect(history.getByTestId('tool-call-call_1')).toContainText('plan_update');

  const result = { role: 'tool', tool_call_id: 'call_1', content: 'plan updated', created_at: turnTimestamp };
  socket.send(frame(result));

  await expect(history.getByTestId('tool-result-call_1')).toContainText('plan updated');
  await expect(history.getByTestId('turn-tool-count')).toContainText('1 tool');
});

test('reads an edit as a diff built from its arguments', async ({ page }) => {
  const { socket, history } = await openTurn(page, first);

  const args = JSON.stringify({ path: 'src/app.ts', old_string: 'const a = 1;', new_string: 'const a = 2;' });
  socket.send(
    frame({
      role: 'assistant',
      content: 'Done.',
      created_at: turnTimestamp,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'edit_file', arguments: args } }],
    }),
  );
  socket.send(frame({ role: 'tool', tool_call_id: 'call_1', content: 'Successfully edited src/app.ts', created_at: turnTimestamp }));

  // The tool only reports a verdict, so the change itself has to come from the
  // arguments: that is the whole reason the diff is worth rendering.
  const diff = history.getByTestId('tool-diff-call_1');
  await expect(diff).toContainText('@@ src/app.ts @@');
  await expect(diff).toContainText('- const a = 1;');
  await expect(diff).toContainText('+ const a = 2;');
  await expect(history.getByTestId('tool-meta-call_1')).toContainText('+1 −1');
  await expect(history.getByTestId('tool-result-call_1')).toHaveCount(0);
});

test('surfaces a stream error in the alert stack', async ({ page }) => {
  const { socket } = await openTurn(page, first);

  socket.send(frame({ type: 'error', content: 'APIConnectionError: Connection error.' }));

  await expect(page.getByRole('alert')).toContainText('APIConnectionError: Connection error.');
});

test('shows the plan the session already holds when the chat opens', async ({ page }) => {
  await openTurn(page, {
    ...first,
    plan_items: [
      { id: 'p1', content: 'Draft the plan', status: 'completed' },
      { id: 'p2', content: 'Ship it', status: 'pending' },
    ],
  });

  const card = page.getByTestId('chat-plan-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Draft the plan');
  await expect(card).toContainText('Completed');
});

test('replaces the plan as the engine pushes a new one', async ({ page }) => {
  const { socket } = await openTurn(page, first);

  socket.send(
    frame([
      { id: 'p1', content: 'Add the list page', status: 'completed' },
      { id: 'p2', content: 'Add the detail page', status: 'in_progress' },
      { id: 'p3', content: 'Ship it', status: 'pending' },
    ]),
  );

  const card = page.getByTestId('chat-plan-card');
  await expect(card).toContainText('Add the list page');
  await expect(card).toContainText('Add the detail page');
  await expect(card.getByTestId('chat-plan-footer')).toContainText('3 items · 1 completed · 1 in progress');

  // A plan the engine clears takes the card with it rather than freezing it.
  socket.send(frame([]));
  await expect(card).toBeHidden();
});

test('floats the plan over the history without scrolling away', async ({ page }) => {
  const messages = Array.from({ length: 40 }, (_, index) => ({
    seq: index,
    role: index % 2 === 0 ? 'user' : 'assistant',
    data: index % 2 === 0 ? { role: 'user', content: [{ type: 'text', text: `message ${index}` }], created_at: turnTimestamp } : { role: 'assistant', content: `reply ${index}`, created_at: turnTimestamp },
    created_at: turnTimestamp,
  }));

  await mockBackend(page, {
    session: boss,
    sessions: [{ ...first, messages, plan_items: [{ id: 'p1', content: 'Draft the plan', status: 'in_progress' }] }],
    agents: [agent],
    providers: [provider],
  });
  await seedSession(page);

  await page.goto(`/en/chat/${first.id}`);
  const card = page.getByTestId('chat-plan-card');
  await expect(card).toBeVisible();

  // The plan lives in its own floating dock, not in the scrolling history.
  await expect(page.locator('#chat-history [data-testid="chat-plan-card"]')).toHaveCount(0);
  await expect(page.getByTestId('chat-plan-dock')).toHaveCSS('position', 'fixed');

  const before = await card.boundingBox();
  expect(before).not.toBeNull();

  // The history keeps clear of the floating card.
  await page.locator('#app-scroll').evaluate((el) => {
    el.scrollTop = 0;
  });
  const firstMessage = await page.getByText('message 0').boundingBox();
  expect(firstMessage).not.toBeNull();
  expect(firstMessage?.y ?? 0).toBeGreaterThanOrEqual((before?.y ?? 0) + (before?.height ?? 0) - 2);

  await page.locator('#app-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  const after = await card.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2);
});

test('keeps a user bubble inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });

  const messages = [
    { seq: 0, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'a somewhat longer opening question' }], created_at: turnTimestamp }, created_at: turnTimestamp },
    { seq: 1, role: 'assistant', data: { role: 'assistant', content: 'answer', created_at: turnTimestamp, id: 'a1' }, created_at: turnTimestamp },
    { seq: 2, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'follow up' }], created_at: turnTimestamp, id: 'm2' }, created_at: turnTimestamp },
  ];

  await mockBackend(page, { session: boss, sessions: [{ ...first, messages }], agents: [agent], providers: [provider] });
  await seedSession(page);

  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);

  await page.goto(`/en/chat/${first.id}`);

  const history = page.locator('#chat-history');
  await expect(history).toContainText('follow up');

  const bubbles = page.getByTestId('user-message');
  await expect(bubbles).toHaveCount(2);

  // A capped bubble that cannot shrink escapes its column, so check the column
  // itself stays free of horizontal overflow and every bubble sits on screen.
  await expect.poll(async () => history.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);

  for (const bubble of await bubbles.all()) {
    const box = await bubble.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(391);
  }
});

test('keeps a short bubble at a readable width and a long one at the column edge', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  const messages = [
    { seq: 0, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'hi' }], created_at: turnTimestamp }, created_at: turnTimestamp },
    { seq: 1, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'word '.repeat(120) }], created_at: turnTimestamp }, created_at: turnTimestamp },
  ];

  await mockBackend(page, { session: boss, sessions: [{ ...first, messages }], agents: [agent], providers: [provider] });
  await seedSession(page);

  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);

  await page.goto(`/en/chat/${first.id}`);

  const bubbles = page.getByTestId('user-message');
  await expect(bubbles).toHaveCount(2);

  const short = await bubbles.nth(0).boundingBox();
  expect(short).not.toBeNull();
  expect(short?.width ?? 0).toBeCloseTo(384, 0);

  const long = await bubbles.nth(1).evaluate((el) => {
    const parent = el.parentElement as HTMLElement;
    const padding = parseFloat(getComputedStyle(parent).paddingLeft) + parseFloat(getComputedStyle(parent).paddingRight);
    const box = el.getBoundingClientRect();
    return { width: box.width, right: box.right, limit: (parent.clientWidth - padding) * 0.9, edge: parent.getBoundingClientRect().right - padding / 2 };
  });

  expect(long.width).toBeCloseTo(long.limit, 0);
  expect(long.right).toBeCloseTo(long.edge, 0);
});

test('shows the socket as connected while it is open', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first] });
  await seedSession(page);

  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);

  await page.goto(`/en/chat/${first.id}`);

  await expect(page.getByTestId('chat-status')).toHaveClass(/status-success/);
});

test('reverts a user turn once the confirm dialog is accepted', async ({ page }) => {
  const messages = [
    { seq: 0, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'first question' }], created_at: turnTimestamp, id: 'm1' }, created_at: turnTimestamp },
    { seq: 1, role: 'assistant', data: { role: 'assistant', content: 'first answer', created_at: turnTimestamp, id: 'a1' }, created_at: turnTimestamp },
    { seq: 2, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'second question' }], created_at: turnTimestamp, id: 'm2' }, created_at: turnTimestamp },
    { seq: 3, role: 'assistant', data: { role: 'assistant', content: 'second answer', created_at: turnTimestamp, id: 'a2' }, created_at: turnTimestamp },
  ];

  const state = await mockBackend(page, { session: boss, sessions: [{ ...first, messages }], agents: [agent], providers: [provider] });
  await seedSession(page);

  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);
  await page.route(/\/agent-api\/chat\/[^/]+\/replay$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  const reverted: unknown[] = [];
  await page.route(/\/agent-api\/chat\/[^/]+\/revert$/, async (route) => {
    reverted.push(route.request().postDataJSON());
    const session = state.sessions.find((candidate) => candidate.id === first.id);
    if (session) {
      session.messages = session.messages?.slice(0, 2);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ session_id: first.id, message_id: 'm2' }) });
  });

  await page.goto(`/en/chat/${first.id}`);

  const history = page.locator('#chat-history');
  await expect(history).toContainText('second question');

  // The opening turn keeps its icon hidden: reverting it would drop the whole chat.
  const revertButtons = page.getByTestId('user-message-revert');
  await expect(revertButtons).toHaveCount(1);

  await revertButtons.first().click();
  const modal = page.getByTestId('form-modal-box');
  await expect(modal).toContainText('This message and everything after it will be removed.');

  await modal.getByRole('button', { name: 'Revert' }).click();

  await expect.poll(() => reverted).toEqual([{ message_id: 'm2' }]);
  await expect(history).not.toContainText('second question');
  await expect(history).toContainText('first answer');
  await expect(page.getByTestId('user-message-revert')).toHaveCount(0);
});

const copyMessages: MockSessionMessage[] = [
  { seq: 0, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'first question' }], created_at: turnTimestamp, id: 'm1' }, created_at: turnTimestamp },
  { seq: 1, role: 'assistant', data: { role: 'assistant', content: 'first answer', created_at: turnTimestamp, id: 'a1' }, created_at: turnTimestamp },
  { seq: 2, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'second question' }], created_at: turnTimestamp, id: 'm2' }, created_at: turnTimestamp },
];

async function openSeededChat(page: Page, messages: MockSessionMessage[]) {
  await mockBackend(page, { session: boss, sessions: [{ ...first, messages }], agents: [agent], providers: [provider] });
  await seedSession(page);
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as Window & { copiedText?: string }).copiedText = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto(`/en/chat/${first.id}`);
  await expect(page.getByTestId('user-message').first()).toBeVisible();
}

function copiedText(page: Page) {
  return page.evaluate(() => (window as Window & { copiedText?: string }).copiedText);
}

test.describe('copy', () => {
  test('copies a user turn to the clipboard and confirms it', async ({ page }) => {
    await openSeededChat(page, copyMessages);

    await page.getByTestId('user-message-copy').first().click();

    await expect(page.getByRole('alert')).toContainText('Copied the message.');
    await expect.poll(() => copiedText(page)).toBe('first question');
  });

  test('copies the answer of an assistant turn', async ({ page }) => {
    await openSeededChat(page, copyMessages);

    await page.getByTestId('assistant-message-copy').click();

    await expect(page.getByRole('alert')).toContainText('Copied the message.');
    await expect.poll(() => copiedText(page)).toBe('first answer');
  });

  test('keeps the time, copy and revert controls on one row', async ({ page }) => {
    await openSeededChat(page, copyMessages);

    const row = await Promise.all(
      ['user-message-time', 'user-message-copy', 'user-message-revert'].map(async (testId) => {
        const box = await page.getByTestId(testId).last().boundingBox();
        return box ? box.y + box.height / 2 : undefined;
      }),
    );

    expect(row.every((centre) => centre !== undefined)).toBe(true);
    expect(Math.max(...(row as number[])) - Math.min(...(row as number[]))).toBeLessThanOrEqual(2);
  });

  test('leaves out the copy control when a turn has no text', async ({ page }) => {
    await openSeededChat(page, [{ ...copyMessages[0], data: { ...copyMessages[0].data, content: [{ type: 'image_url', image_url: { url: 'a.png' } }] } }]);

    await expect(page.getByTestId('user-message')).toHaveCount(1);
    await expect(page.getByTestId('user-message-copy')).toHaveCount(0);
  });
});

test('reconnects when the socket drops and shows the connection again', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first] });
  await seedSession(page);

  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    sockets.push(ws);
  });

  await page.goto(`/en/chat/${first.id}`);

  const status = page.getByTestId('chat-status');
  await expect(status).toHaveClass(/status-success/);

  sockets[0].close();
  await expect(status).toHaveClass(/status-error/);

  await expect.poll(() => sockets.length, { timeout: 10000 }).toBe(2);
  await expect(status).toHaveClass(/status-success/);
});

test('renews the token and opens a fresh socket when the socket is rejected', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first] });
  await seedSession(page);

  const sockets: WebSocketRoute[] = [];
  const tokens: (string | null)[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    sockets.push(ws);
    tokens.push(new URL(ws.url()).searchParams.get('token'));
  });

  await page.goto(`/en/chat/${first.id}`);
  await expect(page.getByTestId('chat-status')).toHaveClass(/status-success/);
  await expect.poll(() => sockets.length).toBe(1);

  sockets[0].close({ code: 4401 });

  await expect.poll(() => sockets.length, { timeout: 10000 }).toBe(2);
  await expect(page.getByTestId('chat-status')).toHaveClass(/status-success/);
  expect(tokens).toEqual(['access-token-1', 'access-token-2']);
});

test('renews the token before sending a turn the session aged out of', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first], agents: [agent], providers: [provider] });
  await page.clock.install();
  const seeded = jwtExpiringIn(3600);
  await page.addInitScript((token: string) => {
    localStorage.setItem('rqark.auth.tokens', JSON.stringify({ accessToken: token, refreshToken: 'refresh-token' }));
  }, seeded);

  const tokens: (string | null)[] = [];
  const sent: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    tokens.push(new URL(ws.url()).searchParams.get('token'));
    ws.onMessage((message) => sent.push(String(message)));
  });

  await page.goto(`/en/chat/${first.id}`);
  await expect(page.getByTestId('chat-status')).toHaveClass(/status-success/);
  expect(tokens).toEqual([seeded]);

  await page.clock.setSystemTime(Date.now() + 3600 * 1000);

  const input = page.getByTestId('chat-input');
  await input.fill('hello there');
  await page.getByTestId('chat-send').click();

  await expect.poll(() => tokens.length).toBe(2);
  expect(tokens[1]).toBe('access-token-1');
  // The socket is told the renewed token before the turn is sent on it.
  await expect
    .poll(() => sent.filter((message) => !message.includes('"kind":"token"')))
    .toEqual([JSON.stringify({ content: 'hello there', provider: 'openai', agent: 'researcher' })]);
  await expect(input).toBeEmpty();
});

test('retries a rejected agent-cloud call with a refreshed token', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first], agents: [agent], providers: [provider] });
  await seedSession(page);

  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);

  const authorizations: (string | undefined)[] = [];
  await page.route(/\/agent-api\/chat\/[^/]+\/replay$/, async (route) => {
    authorizations.push(route.request().headers()['authorization']);
    const rejected = authorizations.length === 1;
    await route.fulfill({
      status: rejected ? 401 : 200,
      contentType: 'application/json',
      body: rejected ? JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired access token.' } }) : '[]',
    });
  });

  await page.goto(`/en/chat/${first.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();

  await expect.poll(() => authorizations.length).toBe(2);
  expect(authorizations).toEqual(['Bearer access-token-1', 'Bearer access-token-2']);
});

test('shows a loading state until the session history lands', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [{ ...first, messages: copyMessages }], agents: [agent], providers: [provider] });
  await seedSession(page);
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);

  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/api\/sessions\/[^/]+\/messages$/, async (route) => {
    await held;
    await route.fallback();
  });

  await page.goto(`/en/chat/${first.id}`);

  const loading = page.getByTestId('chat-loading');
  await expect(loading).toBeVisible();
  await expect(loading.locator('.loading-spinner')).toBeVisible();
  await expect(page.getByTestId('user-message')).toHaveCount(0);

  // Centred in the page, not tucked under the plan dock.
  const pageBox = await page.getByTestId('chat-page').boundingBox();
  const box = await loading.locator('.loading-spinner').boundingBox();
  expect(pageBox).not.toBeNull();
  expect(box).not.toBeNull();
  if (pageBox && box) {
    expect(Math.abs(box.x + box.width / 2 - (pageBox.x + pageBox.width / 2))).toBeLessThan(4);
    expect(Math.abs(box.y + box.height / 2 - (pageBox.y + pageBox.height / 2))).toBeLessThan(40);
  }

  release?.();

  await expect(loading).toBeHidden();
  await expect(page.getByTestId('user-message')).toHaveCount(2);
});

test.describe('bubble corners', () => {
  test('the user bubble follows the radius of the active theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openSeededChat(page, copyMessages);

    const radius = () =>
      page
        .getByTestId('user-message')
        .first()
        .evaluate((node) => getComputedStyle(node).borderTopLeftRadius);

    await expect.poll(radius).toBe('8px');

    await page.goto('/en/settings');
    await page.selectOption('#settings-theme', 'matrix');
    await page.goto(`/en/chat/${first.id}`);
    await expect(page.getByTestId('user-message').first()).toBeVisible();

    await expect.poll(radius).toBe('0px');
  });
});
