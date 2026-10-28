import { expect, test } from '@playwright/test';
import { boss, mockBackend, seedSession } from './support/mock-backend';

const session = {
  id: 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee',
  title: 'Voice',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

const agent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };
const provider = { id: 'provider-1', name: 'openai-with-a-long-model-name', model_name: 'gpt-5-mini-with-a-long-name', created_at: '2026-01-01T00:00:00Z' };

test.use({ viewport: { width: 320, height: 568 } });

async function openChat(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.resolve({ getTracks: () => [] }) },
      configurable: true,
    });
    class StubRecorder {
      public static isTypeSupported = () => true;
      public state = 'inactive';
      public mimeType = 'audio/webm';
      public ondataavailable: ((event: { data: Blob }) => void) | null = null;
      public onstop: (() => void) | null = null;
      public start() {
        this.state = 'recording';
      }
      public stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { value: StubRecorder, configurable: true });
  });

  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider] });
  await seedSession(page);
  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
}

test('keeps the mic button inside a narrow toolbar', async ({ page }) => {
  await openChat(page);

  const fits = await page.evaluate(() => {
    const area = document.querySelector('#chat-input-area') as HTMLElement;
    const mic = document.querySelector('[data-testid="chat-mic"]') as HTMLElement;
    return {
      micRight: mic.getBoundingClientRect().right,
      areaRight: area.getBoundingClientRect().right,
      docScroll: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
    };
  });

  expect(await page.getByTestId('chat-mic').isVisible()).toBe(true);
  expect(fits.micRight).toBeLessThanOrEqual(fits.areaRight);
  expect(fits.docScroll).toBeLessThanOrEqual(fits.winWidth);
});

test('reads a transcription error across the full width when the screen is narrow', async ({ page }) => {
  await openChat(page);
  await page.route('**/agent-api/asr', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'ASR_BUSY', message: 'busy' } }) }));

  const mic = page.getByTestId('chat-mic');
  await mic.click();
  await expect(mic).toHaveAttribute('aria-pressed', 'true');
  await mic.click();

  const error = page.getByTestId('chat-mic-error');
  await expect(error).toBeVisible();

  const widths = await page.evaluate(() => {
    const area = document.querySelector('#chat-input-area') as HTMLElement;
    const box = document.querySelector('[data-testid="chat-mic-error"]') as HTMLElement;
    return { box: box.getBoundingClientRect().width, area: area.getBoundingClientRect().width };
  });

  expect(widths.box).toBeGreaterThan(widths.area * 0.8);
});
