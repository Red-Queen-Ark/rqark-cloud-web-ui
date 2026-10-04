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

test('shows the socket as connected while it is open', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first] });
  await seedSession(page);

  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);

  await page.goto(`/en/chat/${first.id}`);

  await expect(page.getByTestId('chat-status')).toHaveClass(/status-accent/);
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
  await expect(status).toHaveClass(/status-accent/);

  sockets[0].close();
  await expect(status).toHaveClass(/status-error/);

  await expect.poll(() => sockets.length, { timeout: 10000 }).toBe(2);
  await expect(status).toHaveClass(/status-accent/);
});
