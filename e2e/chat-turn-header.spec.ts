import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockAgent, type MockProvider, type MockSession, type MockSessionMessage } from './support/mock-backend';

const session: MockSession = {
  id: 'cccccccc-1111-4111-8111-cccccccccccc',
  title: 'A long turn',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

const agent: MockAgent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };

const provider: MockProvider = { id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' };

const START = '2026-05-06T07:08:09Z';
const END = '2026-05-06T07:09:09Z';

const STEPS = 12;

function longTurn(): MockSessionMessage[] {
  const messages: MockSessionMessage[] = [{ seq: 0, role: 'user', data: { id: 'u1', role: 'user', content: [{ type: 'text', text: 'dig through it' }], created_at: START }, created_at: START }];
  for (let step = 0; step < STEPS; step += 1) {
    const seq = messages.length;
    messages.push({
      seq,
      role: 'assistant',
      data: {
        role: 'assistant',
        content: '',
        reasoning_content: `step ${step}: ${'weighing the evidence, one line at a time. '.repeat(6)}`,
        tool_calls: [{ id: `call-${step}`, type: 'function', function: { name: 'exec', arguments: '{"command":"ls"}' } }],
        created_at: END,
      },
      created_at: END,
    });
    messages.push({ seq: seq + 1, role: 'tool', data: { role: 'tool', tool_call_id: `call-${step}`, content: `result ${step}`, created_at: END }, created_at: END });
  }
  messages.push({ seq: messages.length, role: 'assistant', data: { role: 'assistant', content: Array.from({ length: 20 }, (_, line) => `answer line ${line}`).join('\n\n'), created_at: END }, created_at: END });
  return messages;
}

async function openTurn(page: Page) {
  await mockBackend(page, { session: boss, sessions: [{ ...session, messages: longTurn() }], agents: [agent], providers: [provider] });
  await seedSession(page);
  await page.goto(`/en/chat/${session.id}`);
  const fold = page.locator('[data-testid^="turn-activity-"]');
  await expect(fold).toBeAttached();
  await fold.locator('> summary').click();
  await expect(fold).toHaveAttribute('open', '');
  await expect.poll(() => fold.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(400);
  return fold;
}

async function offsetInMain(page: Page, selector: string, edge: 'top' | 'bottom'): Promise<number> {
  return page.evaluate(
    ({ selector, edge }) => {
      const main = document.querySelector('#app-scroll') as HTMLElement;
      const element = document.querySelector(selector) as HTMLElement;
      const rect = element.getBoundingClientRect();
      return (edge === 'top' ? rect.top : rect.bottom) - main.getBoundingClientRect().top + main.scrollTop;
    },
    { selector, edge },
  );
}

async function scrollTo(page: Page, top: number) {
  await page.locator('#app-scroll').evaluate((el, value) => {
    el.scrollTop = value;
  }, top);
}

function viewportTops(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('#app-scroll') as HTMLElement;
    const dock = document.querySelector('[data-testid="chat-plan-dock"]') as HTMLElement;
    const header = document.querySelector('[data-testid^="turn-activity-"] > summary') as HTMLElement;
    // The line holds clear of the plan dock rather than at the very top of the
    // scroll container, so the dock's height is part of the expected position.
    return { main: main.getBoundingClientRect().top, dock: dock.offsetHeight, header: header.getBoundingClientRect().top };
  });
}

test('the worked-for line holds at the top of the chat while its turn is read', async ({ page }) => {
  await openTurn(page);

  await scrollTo(page, (await offsetInMain(page, '[data-testid^="turn-activity-"]', 'top')) + 200);

  const { main, dock, header } = await viewportTops(page);
  expect(Math.abs(header - (main + dock))).toBeLessThanOrEqual(1);
});

test('the line leaves with its turn rather than hanging over the answer', async ({ page }) => {
  await openTurn(page);

  await page.locator('#app-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  const { main, header } = await viewportTops(page);
  expect(header).toBeLessThan(main - 10);
});

test('the fold clips its own text as it shuts instead of letting it spill over the answer', async ({ page }) => {
  await openTurn(page);

  const spilled = await page.evaluate(async () => {
    const details = document.querySelector('[data-testid^="turn-activity-"]') as HTMLElement;
    const summary = details.querySelector('summary') as HTMLElement;
    const box = details.getBoundingClientRect();
    const samples: string[] = [];
    summary.click();
    for (let frame = 0; frame < 8; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const rect = details.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, rect.bottom + 3);
      if (hit && details.contains(hit)) {
        samples.push(`frame ${frame}: ${hit.className.slice(0, 40)}`);
      }
    }
    return samples;
  });

  expect(spilled).toEqual([]);
});
