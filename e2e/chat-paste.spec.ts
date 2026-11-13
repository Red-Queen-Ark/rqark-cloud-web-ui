import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockSession } from './support/mock-backend';

const session: MockSession = {
  id: 'cccccccc-1111-4111-8111-cccccccccccc',
  title: 'Paste chat',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

/** Drops `text` into the composer the way the browser would, at the current caret. */
async function paste(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
}

function editorText(page: Page): Promise<string> {
  return page.getByTestId('chat-input').evaluate((el) => (el as HTMLElement).innerText);
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [session] });
  await seedSession(page);
  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
});

test('takes back a pasted block with Ctrl+Z', async ({ page }) => {
  const input = page.getByTestId('chat-input');
  await input.click();
  await paste(page, 'first line\nsecond line');

  await expect.poll(() => editorText(page)).toBe('first line\nsecond line');

  await page.keyboard.press('Control+z');

  await expect.poll(() => editorText(page)).toBe('');
});

test('keeps the text around a paste, and the undo puts it back as it was', async ({ page }) => {
  const input = page.getByTestId('chat-input');
  await input.click();
  await input.pressSequentially('ab');

  await paste(page, 'X\nY');
  await expect.poll(() => editorText(page)).toBe('abX\nY');

  await page.keyboard.press('Control+z');
  await expect.poll(() => editorText(page)).toBe('ab');
});

test('pastes markup characters as text', async ({ page }) => {
  const input = page.getByTestId('chat-input');
  await input.click();
  await paste(page, '<b>not bold</b> & done');

  await expect.poll(() => editorText(page)).toBe('<b>not bold</b> & done');
  await expect(input.locator('b')).toHaveCount(0);
});
