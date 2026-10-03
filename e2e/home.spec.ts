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
