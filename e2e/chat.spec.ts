import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockSession } from './support/mock-backend';

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
