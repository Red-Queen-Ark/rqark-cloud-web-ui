import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { boss, mockBackend, seedSession } from './support/mock-backend';

const tone = fileURLToPath(new URL('./fixtures/voice-tone.wav', import.meta.url));

const session = {
  id: 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee',
  title: 'Voice',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

const agent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };
const provider = { id: 'provider-1', name: 'openai', model_name: 'gpt-5-mini-with-a-long-name', created_at: '2026-01-01T00:00:00Z' };

test.use({
  viewport: { width: 320, height: 568 },
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${tone}`],
  },
});

type VoiceSocket = Parameters<Parameters<Page['routeWebSocket']>[1]>[0];

async function openChat(page: Page, ready: Record<string, unknown> = {}): Promise<() => VoiceSocket | undefined> {
  let socket: VoiceSocket | undefined;
  await page.routeWebSocket(/\/agent-api\/voice\/ws/, (ws) => {
    socket = ws;
    ws.send(JSON.stringify({ type: 'ready', sample_rate: 16000, format: 'pcm_s16le', channels: 1, wake_word: true, vad: true, ...ready }));
  });
  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider] });
  await seedSession(page);
  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();
  return () => socket;
}

test('keeps both voice buttons inside a narrow toolbar', async ({ page }) => {
  await openChat(page);

  const fits = await page.evaluate(() => {
    const area = document.querySelector('#chat-input-area') as HTMLElement;
    const voice = document.querySelector('[data-testid="chat-voice"]') as HTMLElement;
    const mic = document.querySelector('[data-testid="chat-mic"]') as HTMLElement;
    return {
      voiceRight: voice.getBoundingClientRect().right,
      micRight: mic.getBoundingClientRect().right,
      areaRight: area.getBoundingClientRect().right,
      docScroll: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
    };
  });

  expect(await page.getByTestId('chat-voice').isVisible()).toBe(true);
  expect(fits.voiceRight).toBeLessThanOrEqual(fits.areaRight);
  expect(fits.micRight).toBeLessThanOrEqual(fits.areaRight);
  expect(fits.docScroll).toBeLessThanOrEqual(fits.winWidth);
});

test('reports a server error without pushing the layout sideways', async ({ page }) => {
  const socket = await openChat(page);

  const mic = page.getByTestId('chat-mic');
  await mic.click();
  await expect(mic).toHaveAttribute('aria-pressed', 'true');
  socket()?.send(JSON.stringify({ type: 'error', error: { code: 'ASR_BUSY', message: 'busy' } }));

  await expect(page.getByRole('alert').filter({ hasText: 'The transcriber is busy, try again shortly' })).toBeVisible();

  const fits = await page.evaluate(() => ({ docScroll: document.documentElement.scrollWidth, winWidth: window.innerWidth }));

  expect(fits.docScroll).toBeLessThanOrEqual(fits.winWidth);
});
