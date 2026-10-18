import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockAgent, type MockProvider, type MockSession, type MockSop } from './support/mock-backend';

const session: MockSession = {
  id: 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee',
  title: 'SOP chat',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

const agent: MockAgent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };

const provider: MockProvider = { id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' };

const sops: MockSop[] = [{ slug: 'trip-itinerary', title: 'Trip itinerary', content: '# Trip itinerary\n\nPlan the trip day by day.' }];

async function openChat(page: Page, seeded: MockSop[] = sops): Promise<WebSocketRoute> {
  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider], sops: seeded });
  await seedSession(page);

  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    socket = ws;
  });

  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
  await expect.poll(() => socket !== undefined).toBe(true);
  return socket as WebSocketRoute;
}

test('typing a slash lists the commands and the sops', async ({ page }) => {
  await openChat(page);

  const input = page.getByTestId('chat-input');
  await input.fill('/');

  await expect(page.getByTestId('slash-panel')).toBeVisible();
  await expect(page.getByTestId('slash-option-compact')).toBeVisible();
  await expect(page.getByTestId('slash-option-trip-itinerary')).toContainText('Trip itinerary');
});

test('choosing a sop fills the input with its slug and sends nothing', async ({ page }) => {
  const socket = await openChat(page);
  const received: string[] = [];
  socket.onMessage((message) => received.push(String(message)));

  const input = page.getByTestId('chat-input');
  await input.fill('/trip');
  await page.getByTestId('slash-option-trip-itinerary').click();

  await expect(input).toHaveText('/trip-itinerary ');
  await expect(page.getByTestId('slash-panel')).toHaveCount(0);
  expect(received).toEqual([]);
});

test('the panel closes once the text carries a space', async ({ page }) => {
  await openChat(page);

  const input = page.getByTestId('chat-input');
  await input.fill('/stop now');

  await expect(page.getByTestId('slash-panel')).toHaveCount(0);
});

test('a deployment without sops still lists the built-in commands', async ({ page }) => {
  await openChat(page, []);

  await page.getByTestId('chat-input').fill('/');

  await expect(page.getByTestId('slash-option-compact')).toBeVisible();
  await expect(page.getByTestId('slash-option-trip-itinerary')).toHaveCount(0);
});
