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

/** The chat upgrades to a WebSocket, which has to be routed separately from fetch. */
function socketPath(url: string): string {
  return new URL(url).pathname;
}

// The socket is intercepted before it leaves the browser, so this asserts the
// url the app builds. The prefix is what the dev server and the reverse proxy
// forward to the agent cloud; `/api` belongs to the data cloud and carries no
// socket, so a url under it would be a regression this file cannot see.
const SOCKET_PREFIX = '/agent-api/chat/ws/';

test('opens the socket of the session in the url', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [first, second] });
  await seedSession(page);

  const opened: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    opened.push(ws.url());
  });

  await page.goto(`/en/chat/${first.id}`);
  // The page is still an empty container, so it has no box to be "visible": what
  // this waits for is the route having rendered the chat component at all.
  await expect(page.getByTestId('chat-page')).toBeAttached();

  await expect.poll(() => opened.map(socketPath)).toEqual([`${SOCKET_PREFIX}${first.id}`]);
  // The handshake carries the session token the backend asks for by name.
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
  // Reusing the page must not leave the previous session's socket as the one
  // carrying the conversation.
  await expect.poll(() => opened.map(socketPath)).toEqual([`${SOCKET_PREFIX}${first.id}`, `${SOCKET_PREFIX}${second.id}`]);
});
