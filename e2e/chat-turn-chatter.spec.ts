import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockAgent, type MockProvider, type MockSessionMessage } from './support/mock-backend';

const id = 'bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb';
const START = '2026-05-06T07:08:09Z';
const END = '2026-05-06T07:09:09Z';

const agent: MockAgent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };
const provider: MockProvider = { id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' };

function step(seq: number, thought: string, said: string, call: string): MockSessionMessage[] {
  return [
    {
      seq,
      role: 'assistant',
      data: { role: 'assistant', content: said, reasoning_content: thought, tool_calls: [{ id: call, type: 'function', function: { name: 'edit', arguments: '{}' } }], created_at: END },
      created_at: END,
    },
    { seq: seq + 1, role: 'tool', data: { role: 'tool', tool_call_id: call, content: 'ok', created_at: END }, created_at: END },
  ];
}

function workedTurn(): MockSessionMessage[] {
  return [
    { seq: 0, role: 'user', data: { id: 'u1', role: 'user', content: [{ type: 'text', text: 'refactor it' }], created_at: START }, created_at: START },
    ...step(1, 'let me look at the file', 'now the repository change:', 'call-a'),
    ...step(3, 'the call sites need widening', 'now update the existing test call sites:', 'call-b'),
    { seq: 5, role: 'assistant', data: { role: 'assistant', content: 'done', created_at: END }, created_at: END },
  ];
}

async function openTurn(page: import('@playwright/test').Page) {
  await mockBackend(page, { session: boss, sessions: [{ id, title: 'A working turn', created_at: START, messages: workedTurn() }], agents: [agent], providers: [provider] });
  await seedSession(page);
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);
  await page.goto(`/en/chat/${id}`);
  return page.locator('[data-testid^="turn-activity-"]');
}

test('the answer is only what the turn ended with, not what it narrated on the way', async ({ page }) => {
  await openTurn(page);

  const answer = page.getByTestId('turn-answer');
  await expect(answer).toHaveText('done');
  await expect(answer).not.toContainText('now the repository change:');
  await expect(answer).not.toContainText('now update the existing test call sites:');
});

test('what it narrated on the way is kept, folded in the order it said it', async ({ page }) => {
  const fold = await openTurn(page);

  const chatter = fold.getByTestId('turn-chatter');
  await expect(chatter).toHaveCount(2);

  expect(
    await fold.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const first = el.querySelector('[data-testid="turn-chatter"]') as HTMLElement;
      return first.getBoundingClientRect().top >= box.bottom;
    }),
  ).toBe(true);

  await fold.locator('> summary').click();

  await expect(chatter.first()).toBeVisible();
  await expect(chatter).toHaveText(['now the repository change:', 'now update the existing test call sites:']);

  const order = await fold.evaluate((el) => Array.from(el.querySelectorAll('[data-testid="think-block"], [data-testid="turn-chatter"], [data-testid^="tool-call-"]')).map((node) => node.getAttribute('data-testid')));
  expect(order).toEqual(['think-block', 'turn-chatter', 'tool-call-call-a', 'think-block', 'turn-chatter', 'tool-call-call-b']);
});
