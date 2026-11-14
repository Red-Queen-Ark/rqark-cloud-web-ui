import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockAgent, type MockProvider, type MockSession } from './support/mock-backend';

const session: MockSession = {
  id: 'eeeeeeee-3333-4333-8333-eeeeeeeeeeee',
  title: 'Long chat',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

const agent: MockAgent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };

const provider: MockProvider = { id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' };

const turnTimestamp = '2026-05-06T07:08:09Z';

const TURNS = 40;

function longSession(): MockSession {
  const messages = Array.from({ length: TURNS }, (_, index) => ({
    seq: index,
    role: index % 2 === 0 ? 'user' : 'assistant',
    data: index % 2 === 0 ? { role: 'user', content: [{ type: 'text', text: `message ${index}` }], created_at: turnTimestamp } : { role: 'assistant', content: `reply ${index}`, created_at: turnTimestamp },
    created_at: turnTimestamp,
  }));
  return { ...session, messages };
}

function frame(payload: unknown): string {
  return JSON.stringify({ agent_id: 'researcher:session', path: [], payload });
}

function streamedTurn(): string[] {
  return [frame({ role: 'user', content: [{ type: 'text', text: 'a later question' }], created_at: turnTimestamp }), frame({ type: 'content', content: `${'the answer keeps arriving while the reader looks elsewhere. '.repeat(12)}\n\n` })];
}

async function openLongChat(page: Page): Promise<WebSocketRoute> {
  await mockBackend(page, { session: boss, sessions: [longSession()], agents: [agent], providers: [provider] });
  await seedSession(page);

  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    socket = ws;
  });

  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
  await expect.poll(() => socket !== undefined).toBe(true);
  await expect.poll(() => distanceToTail(page)).toBeLessThanOrEqual(2);
  await expect(page.getByText('reply 39')).toBeInViewport();

  return socket as WebSocketRoute;
}

function distanceToTail(page: Page): Promise<number> {
  return page.locator('#app-scroll').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
}

function scrollTop(page: Page): Promise<number> {
  return page.locator('#app-scroll').evaluate((el) => el.scrollTop);
}

async function pullAway(page: Page): Promise<void> {
  await page.locator('#app-scroll').evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(page.getByTestId('chat-scroll-to-bottom')).toBeVisible();
}

test('opens on the newest message and follows the stream to the tail', async ({ page }) => {
  const socket = await openLongChat(page);

  await expect(page.getByTestId('chat-scroll-to-bottom')).toBeHidden();

  for (const payload of streamedTurn()) {
    socket.send(payload);
  }

  await expect(page.locator('#chat-history')).toContainText('the answer keeps arriving');
  await expect.poll(() => distanceToTail(page)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('chat-scroll-to-bottom')).toBeHidden();
});

test('stays put and offers a way back once the reader pulls away', async ({ page }) => {
  const socket = await openLongChat(page);

  await pullAway(page);
  await expect(page.getByText('message 0')).toBeInViewport();

  for (const payload of streamedTurn()) {
    socket.send(payload);
  }

  await expect(page.locator('#chat-history')).toContainText('the answer keeps arriving');
  expect(await scrollTop(page)).toBe(0);
  await expect(page.getByTestId('chat-scroll-to-bottom')).toBeVisible();
});

test('jumps back to the tail when the button is pressed', async ({ page }) => {
  await openLongChat(page);

  await pullAway(page);
  await page.getByTestId('chat-scroll-to-bottom').click();

  await expect.poll(() => distanceToTail(page)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('chat-scroll-to-bottom')).toBeHidden();
  await expect(page.getByText('reply 39')).toBeInViewport();
});

test('picks the tail back up when the next turn is submitted', async ({ page }) => {
  await openLongChat(page);

  await pullAway(page);
  await page.getByTestId('chat-input').fill('one more');
  await page.getByTestId('chat-send').click();

  await expect.poll(() => distanceToTail(page)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('chat-scroll-to-bottom')).toBeHidden();
});

test('opens a session it switches to on the tail as well', async ({ page }) => {
  const other: MockSession = { id: 'ffffffff-4444-4444-8444-ffffffffffff', title: 'Second long chat', created_at: '2026-04-06T06:07:08Z', updated_at: '2026-04-09T09:10:11Z', messages: longSession().messages };

  await mockBackend(page, { session: boss, sessions: [longSession(), other], agents: [agent], providers: [provider] });
  await seedSession(page);
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);

  await page.goto(`/en/chat/${session.id}`);
  await expect.poll(() => distanceToTail(page)).toBeLessThanOrEqual(2);
  await expect(page.getByText('reply 39')).toBeInViewport();

  await pullAway(page);
  await page.getByTestId('sidebar-chat-sessions').getByRole('link', { name: 'Second long chat' }).click();
  await expect(page).toHaveURL(new RegExp(`/en/chat/${other.id}$`));

  await expect.poll(() => distanceToTail(page)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('chat-scroll-to-bottom')).toBeHidden();
});

test('keeps the newest message clear of the input dock', async ({ page }) => {
  await openLongChat(page);

  const boxes = await page.evaluate(() => {
    const dock = document.querySelector('[data-testid="chat-input-dock"]') as HTMLElement;
    const message = Array.from(document.querySelectorAll('#chat-history *')).find((node) => node.textContent?.trim() === 'reply 39') as HTMLElement;
    return { dockTop: dock.getBoundingClientRect().top, messageBottom: message.getBoundingClientRect().bottom };
  });

  expect(boxes.messageBottom).toBeLessThanOrEqual(boxes.dockTop);
});
