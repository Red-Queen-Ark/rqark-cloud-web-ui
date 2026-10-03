import { expect, test, type Page } from '@playwright/test';
import { boss, mockBackend, seedSession, type MockSession } from './support/mock-backend';

const session: MockSession = {
  id: 'cccccccc-1111-4111-8111-cccccccccccc',
  title: 'Keyboard chat',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

interface KeyboardOptions {
  height?: number;
  offsetTop?: number;
  scale?: number;
}

interface KeyboardWindow {
  __setKeyboard: (options: KeyboardOptions) => void;
}

async function installFakeVisualViewport(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const events = new EventTarget();
    const viewport = {
      height: window.innerHeight,
      offsetTop: 0,
      scale: 1,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    (window as unknown as KeyboardWindow).__setKeyboard = (options) => {
      Object.assign(viewport, options);
      events.dispatchEvent(new Event('resize'));
      events.dispatchEvent(new Event('scroll'));
    };
  });
}

function setKeyboard(page: Page, options: KeyboardOptions): Promise<void> {
  return page.evaluate((next) => (window as unknown as KeyboardWindow).__setKeyboard(next), options);
}

function composerBottom(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="chat-input-dock"]') as Element).bottom);
}

function shellOffset(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.querySelector('#app') as Element).top);
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [session] });
  await seedSession(page);
  await installFakeVisualViewport(page);
  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
});

test('sits at its resting offset without a keyboard', async ({ page }) => {
  expect(await composerBottom(page)).toBe('8px');
  expect(await shellOffset(page)).toBe('0px');
});

test('rises by the keyboard overlap and leaves the shell alone', async ({ page }) => {
  const layout = await page.evaluate(() => document.documentElement.clientHeight);
  await setKeyboard(page, { height: layout - 300 });

  await expect.poll(() => composerBottom(page)).toBe('308px');
  expect(await shellOffset(page)).toBe('0px');
});

test('keeps the shell in place when iOS pans the visual viewport', async ({ page }) => {
  const layout = await page.evaluate(() => document.documentElement.clientHeight);
  await setKeyboard(page, { height: layout - 300, offsetTop: 100 });

  await expect.poll(() => composerBottom(page)).toBe('208px');
  expect(await shellOffset(page)).toBe('100px');
});

test('ignores a pinch zoom, which is not a keyboard', async ({ page }) => {
  const layout = await page.evaluate(() => document.documentElement.clientHeight);
  await setKeyboard(page, { height: layout - 300 });
  await expect.poll(() => composerBottom(page)).toBe('308px');

  await setKeyboard(page, { height: layout - 300, scale: 1.5 });
  await expect.poll(() => composerBottom(page)).toBe('8px');
});

test('returns the shell to its place once the keyboard is gone', async ({ page }) => {
  const layout = await page.evaluate(() => document.documentElement.clientHeight);
  await setKeyboard(page, { height: layout - 300, offsetTop: 100 });
  await expect.poll(() => shellOffset(page)).toBe('100px');

  await setKeyboard(page, { height: layout, offsetTop: 140 });
  await expect.poll(() => composerBottom(page)).toBe('8px');
  expect(await shellOffset(page)).toBe('0px');
});
