import { expect, test, type Locator, type Page, type WebSocketRoute } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockAgent, type MockProvider, type MockSession, type MockSessionMessage } from './support/mock-backend';

const session: MockSession = {
  id: 'cccccccc-1111-4111-8111-cccccccccccc',
  title: 'A turn already read',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

const agent: MockAgent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };

const provider: MockProvider = { id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' };

const START = '2026-05-06T07:08:09Z';
const END = '2026-05-06T07:09:09Z';

function finishedTurn(): MockSessionMessage[] {
  return [
    { seq: 0, role: 'user', data: { id: 'u1', role: 'user', content: [{ type: 'text', text: 'an older question' }], created_at: START }, created_at: START },
    {
      seq: 1,
      role: 'assistant',
      data: {
        role: 'assistant',
        content: '',
        reasoning_content: 'weighing the older question',
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'exec', arguments: '{"command":"ls"}' } }],
        created_at: END,
      },
      created_at: END,
    },
    { seq: 2, role: 'tool', data: { role: 'tool', tool_call_id: 'call-1', content: 'result', created_at: END }, created_at: END },
    { seq: 3, role: 'assistant', data: { role: 'assistant', content: 'the older answer', created_at: END }, created_at: END },
  ];
}

function frame(payload: unknown): string {
  return JSON.stringify({ agent_id: 'researcher:session', path: [], payload });
}

async function openChat(page: Page): Promise<{ socket: WebSocketRoute; sent: string[]; folds: () => Locator }> {
  await mockBackend(page, { session: boss, sessions: [{ ...session, messages: finishedTurn() }], agents: [agent], providers: [provider] });
  await seedSession(page);

  let socket: WebSocketRoute | undefined;
  const sent: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    socket = ws;
    ws.onMessage((message) => sent.push(String(message)));
  });

  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
  await expect.poll(() => socket !== undefined).toBe(true);
  await expect(page.locator('[data-testid^="turn-activity-"]')).toHaveCount(1);

  return { socket: socket as WebSocketRoute, sent, folds: () => page.locator('[data-testid^="turn-activity-"]') };
}

test('a sent turn opens nothing until its own turn is on screen', async ({ page }) => {
  const { sent, socket, folds } = await openChat(page);
  const older = folds().first();

  await expect(older).not.toHaveAttribute('open', '');

  await page.getByTestId('chat-input').fill('a newer question');
  await page.getByTestId('chat-send').click();

  await expect.poll(() => sent.length).toBe(1);
  await expect(older).not.toHaveAttribute('open', '');

  socket.send(frame({ role: 'user', content: [{ type: 'text', text: 'a newer question' }], created_at: END }));
  socket.send(frame({ type: 'reasoning_content', content: 'weighing the newer question' }));

  await expect(folds()).toHaveCount(2);
  await expect(folds().nth(1)).toHaveAttribute('open', '');
  await expect(older).not.toHaveAttribute('open', '');
});

test('the older turn stays shut for the whole of the newer one', async ({ page }) => {
  const { sent, socket, folds } = await openChat(page);
  const older = folds().first();

  await page.getByTestId('chat-input').fill('a newer question');
  await page.getByTestId('chat-send').click();
  await expect.poll(() => sent.length).toBe(1);

  socket.send(frame({ role: 'user', content: [{ type: 'text', text: 'a newer question' }], created_at: END }));
  socket.send(frame({ type: 'reasoning_content', content: 'weighing the newer question' }));
  socket.send(frame({ role: 'assistant', content: '', created_at: END, tool_calls: [{ id: 'call-2', type: 'function', function: { name: 'exec', arguments: '{}' } }] }));

  await expect(folds()).toHaveCount(2);
  await expect(older).not.toHaveAttribute('open', '');

  socket.send(frame({ role: 'assistant', content: 'the newer answer', created_at: END }));

  await expect(page.locator('#chat-history')).toContainText('the newer answer');
  await expect(folds()).toHaveCount(2);
  await expect(older).not.toHaveAttribute('open', '');
});
