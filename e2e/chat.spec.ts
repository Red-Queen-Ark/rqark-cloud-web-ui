import { expect, test, type Locator, type Page, type WebSocketRoute } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockAgent, type MockProvider, type MockSession } from './support/mock-backend';
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
  expect(new URL(opened[0]).searchParams.get('token')).toBe('access-token');
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

test('shows the reasoning the agent streamed', async ({ page }) => {
  const { socket, history } = await openTurn(page, first);

  socket.send(frame({ type: 'reasoning_content', content: 'Let me check the sky.' }));

  await expect(history.getByText('think')).toBeVisible();
  await expect(history).toContainText('Let me check the sky.');
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
  await expect(history).toContainText('use plan_update');

  const result = { role: 'tool', tool_call_id: 'call_1', content: 'plan updated', created_at: turnTimestamp };
  socket.send(frame(result));

  await expect(history.getByText('plan_update - result')).toHaveCount(1);
  await expect(history).toContainText('plan updated');
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
