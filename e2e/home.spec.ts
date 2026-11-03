import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession } from './support/mock-backend';

test('welcomes the user on the start page', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);

  await page.goto('/en');

  await expect(page.getByTestId('home-hero')).toContainText('Welcome to');
  await expect(page.getByTestId('home-hero')).toContainText('Your AI assistant is ready');
  await expect(page.getByTestId('chat-input')).toBeVisible();
});

test('shows the agent cloud as connected once it answers a ping', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.route('**/agent-api/ping', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'pong' }) }));

  await page.goto('/en');

  await expect(page.getByTestId('chat-status')).toHaveClass(/status-success/);
});

test('shows the agent cloud as unreachable when the ping fails', async ({ page }) => {
  await mockBackend(page, { session: boss });
  await seedSession(page);
  await page.route('**/agent-api/ping', (route) => route.abort());

  await page.goto('/en');

  await expect(page.getByTestId('chat-status')).toHaveClass(/status-error/);
});

test('starts a session with the first turn typed on the start page', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    agents: [{ id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' }],
    providers: [{ id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' }],
  });
  await seedSession(page);

  const sent: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    ws.onMessage((message) => sent.push(String(message)));
  });

  await page.goto('/en');

  const input = page.getByTestId('chat-input');
  await expect(input).toBeEnabled();
  await input.fill('hello there');
  await page.getByTestId('chat-send').click();

  await expect(page).toHaveURL(/\/en\/chat\/session-1$/);
  await expect.poll(() => sent).toEqual([JSON.stringify({ content: 'hello there', provider: 'openai', agent: 'researcher' })]);
});

test('starts on the default agent stored for the source', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    agents: [
      { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' },
      { id: 'agent-2', name: 'writer', description: '', created_at: '2026-01-01T00:00:00Z' },
    ],
    agentDefaults: { AGENT_CLOUD: 'agent-2' },
    providers: [{ id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' }],
  });
  await seedSession(page);

  const sent: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    ws.onMessage((message) => sent.push(String(message)));
  });

  await page.goto('/en');

  // The picker comes up on the stored agent, not on the first one listed.
  await expect(page.locator('#chat-input-area select').nth(1)).toHaveValue('writer');

  const input = page.getByTestId('chat-input');
  await expect(input).toBeEnabled();
  await input.fill('hello there');
  await page.getByTestId('chat-send').click();

  await expect(page).toHaveURL(/\/en\/chat\/session-1$/);
  await expect.poll(() => sent).toEqual([JSON.stringify({ content: 'hello there', provider: 'openai', agent: 'writer' })]);
});

test('keeps the agent picked on the start page after the chat opens', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    agents: [
      { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' },
      { id: 'agent-2', name: 'writer', description: '', created_at: '2026-01-01T00:00:00Z' },
    ],
    providers: [{ id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' }],
  });
  await seedSession(page);

  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, () => undefined);

  await page.goto('/en');

  const picker = page.locator('#chat-input-area select').nth(1);
  await picker.selectOption('writer');

  const input = page.getByTestId('chat-input');
  await input.fill('hello there');
  await page.getByTestId('chat-send').click();

  // The chat page mounts its own picker, which has no default to fall back on:
  // without the turn's agent it came up on the first one listed.
  await expect(page).toHaveURL(/\/en\/chat\/session-1$/);
  await expect(picker).toHaveValue('writer');
});

test('starts on the first agent when the source holds no default', async ({ page }) => {
  await mockBackend(page, {
    session: boss,
    agents: [
      { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' },
      { id: 'agent-2', name: 'writer', description: '', created_at: '2026-01-01T00:00:00Z' },
    ],
    providers: [{ id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' }],
  });
  await seedSession(page);

  await page.goto('/en');

  await expect(page.locator('#chat-input-area select').nth(1)).toHaveValue('researcher');
});
