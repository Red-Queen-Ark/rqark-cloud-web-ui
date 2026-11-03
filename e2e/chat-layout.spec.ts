import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockAgent, type MockProvider, type MockSession } from './support/mock-backend';

const session: MockSession = {
  id: 'cccccccc-1111-4111-8111-cccccccccccc',
  title: 'Chat measure',
  created_at: '2026-04-05T06:07:08Z',
  messages: [
    { seq: 0, role: 'user', data: { id: 'u1', role: 'user', content: [{ type: 'text', text: 'how tall is the tower?' }], created_at: '2026-04-05T06:07:08Z' }, created_at: '2026-04-05T06:07:08Z' },
    { seq: 1, role: 'assistant', data: { id: 'a1', role: 'assistant', content: 'Quite tall.\n\nA second paragraph, long enough that a line would run the whole width of a landscape iPad without a cap.', created_at: '2026-04-05T06:07:09Z' }, created_at: '2026-04-05T06:07:09Z' },
  ],
};

const agent: MockAgent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };
const provider: MockProvider = { id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' };

/** 48rem — the chat column's cap, and the widest a line may run on a tablet. */
const MEASURE = 768;

interface Box {
  left: number;
  right: number;
  width: number;
}

function boxOf(page: Page, selector: string): Promise<Box> {
  return page.evaluate((sel) => {
    const rect = (document.querySelector(sel) as HTMLElement).getBoundingClientRect();
    return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
  }, selector);
}

async function openChat(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider] });
  await seedSession(page);
  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
  await expect(page.getByTestId('user-message')).toBeAttached();
}

const TABLETS = [
  { name: 'iPad mini landscape', width: 1024, height: 768 },
  { name: 'iPad 10.2 landscape', width: 1080, height: 810 },
  { name: 'iPad Air landscape', width: 1180, height: 820 },
  { name: 'iPad Pro 13 landscape', width: 1366, height: 1024 },
];

for (const tablet of TABLETS) {
  test(`keeps one measured column on a ${tablet.name}`, async ({ page }) => {
    await openChat(page, tablet.width, tablet.height);

    const history = await boxOf(page, '#chat-history');
    const input = await boxOf(page, '#chat-input-area');
    const plan = await boxOf(page, '[data-testid="chat-plan-dock"] .chat-measure');

    // The transcript, the composer and the plan agree on their edges, so the
    // composer does not look dropped onto a wider shell than the messages.
    expect(input).toEqual(history);
    expect(plan).toEqual(history);
    expect(history.width).toBeLessThanOrEqual(MEASURE);

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(tablet.width);
  });
}

test('fills the width of a phone, where the measure never binds', async ({ page }) => {
  await openChat(page, 390, 844);

  const history = await boxOf(page, '#chat-history');
  const input = await boxOf(page, '#chat-input-area');

  expect(input).toEqual(history);
  expect(history.width).toBeLessThan(MEASURE);
  expect(history.left).toBe(16);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
