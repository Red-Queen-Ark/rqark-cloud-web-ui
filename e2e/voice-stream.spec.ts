import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { boss, mockBackend, seedSession } from './support/mock-backend';

const session = {
  id: 'ffffffff-1111-4111-8111-ffffffffffff',
  title: 'Voice stream',
  created_at: '2026-04-05T06:07:08Z',
  updated_at: '2026-04-08T09:10:11Z',
};

const agent = { id: 'agent-1', name: 'researcher', description: '', created_at: '2026-01-01T00:00:00Z' };
const provider = { id: 'provider-1', name: 'openai', model_name: 'gpt-5', created_at: '2026-01-01T00:00:00Z' };

const tone = fileURLToPath(new URL('./fixtures/voice-tone.wav', import.meta.url));

const BYTES_PER_SECOND = 32000;

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${tone}`],
  },
});

test('streams microphone audio to the voice socket at the wire rate', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider] });
  await seedSession(page);

  const frames: number[] = [];
  await page.routeWebSocket(/\/agent-api\/voice\/ws/, (ws) => {
    ws.onMessage((message) => {
      if (typeof message !== 'string') {
        frames.push(message.length);
      }
    });
    ws.send(JSON.stringify({ type: 'ready', sample_rate: 16000, format: 'pcm_s16le', channels: 1 }));
  });

  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();

  const startedAt = Date.now();
  await page.getByTestId('chat-mic').click();
  await expect(page.getByTestId('chat-mic')).toHaveAttribute('aria-pressed', 'true');

  await expect.poll(() => frames.reduce((total, size) => total + size, 0), { timeout: 8000 }).toBeGreaterThan(BYTES_PER_SECOND);
  const elapsed = (Date.now() - startedAt) / 1000;
  const bytes = frames.reduce((total, size) => total + size, 0);

  expect(bytes % 2).toBe(0);
  const rate = bytes / elapsed;
  expect(rate).toBeGreaterThan(BYTES_PER_SECOND * 0.4);
  expect(rate).toBeLessThan(BYTES_PER_SECOND * 2.5);
});

test('drops the finished transcript into the editor', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider] });
  await seedSession(page);

  let socket: Parameters<Parameters<typeof page.routeWebSocket>[1]>[0] | undefined;
  await page.routeWebSocket(/\/agent-api\/voice\/ws/, (ws) => {
    socket = ws;
    ws.send(JSON.stringify({ type: 'ready', sample_rate: 16000, format: 'pcm_s16le', channels: 1 }));
  });

  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();

  await page.getByTestId('chat-mic').click();
  await expect(page.getByTestId('chat-mic')).toHaveAttribute('aria-pressed', 'true');
  socket?.send(JSON.stringify({ type: 'final', text: '幫我開張發票', duration_ms: 1200, elapsed_ms: 300, truncated: false }));

  await expect(page.getByTestId('chat-input')).toHaveText('幫我開張發票');
  await expect(page.getByTestId('chat-send')).toBeEnabled();
});

test('shows the server error and drops the stream', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider] });
  await seedSession(page);

  let socket: Parameters<Parameters<typeof page.routeWebSocket>[1]>[0] | undefined;
  await page.routeWebSocket(/\/agent-api\/voice\/ws/, (ws) => {
    socket = ws;
    ws.send(JSON.stringify({ type: 'ready', sample_rate: 16000, format: 'pcm_s16le', channels: 1 }));
  });

  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();

  await page.getByTestId('chat-mic').click();
  await expect(page.getByTestId('chat-mic')).toHaveAttribute('aria-pressed', 'true');
  socket?.send(JSON.stringify({ type: 'error', error: { code: 'ASR_BUSY', message: 'busy' } }));

  await expect(page.getByTestId('chat-mic-error')).toHaveText('The transcriber is busy, try again shortly');
  await expect(page.getByTestId('chat-mic')).not.toHaveAttribute('aria-pressed', 'true');
});

test('wakes into voice mode on the wake word and sends the transcript', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider] });
  await seedSession(page);

  let socket: Parameters<Parameters<typeof page.routeWebSocket>[1]>[0] | undefined;
  await page.routeWebSocket(/\/agent-api\/voice\/ws/, (ws) => {
    socket = ws;
    ws.send(JSON.stringify({ type: 'ready', sample_rate: 16000, format: 'pcm_s16le', channels: 1, wake_word: true, vad: true }));
  });
  const turns: string[] = [];
  await page.routeWebSocket(/\/agent-api\/chat\/ws\//, (ws) => {
    ws.onMessage((message) => {
      if (typeof message === 'string') {
        turns.push(message);
      }
    });
  });

  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();

  await page.getByTestId('chat-voice').click();
  await expect(page.getByTestId('chat-voice')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('chat-voice')).toHaveAttribute('title', 'Listening for the wake word — click to stop');
  await expect(page.getByTestId('chat-voice')).toHaveClass(/btn-secondary/);
  await expect(page.getByTestId('chat-mic')).toHaveCount(0);

  socket?.send(JSON.stringify({ type: 'final', text: 'Hey Wednesday', duration_ms: 900, elapsed_ms: 200, truncated: false }));
  await expect(page.getByTestId('chat-input')).toHaveText('');
  await expect(page.getByTestId('chat-voice')).toHaveAttribute('aria-pressed', 'true');

  socket?.send(JSON.stringify({ type: 'wake', score: 0.93 }));
  await expect(page.getByTestId('chat-voice')).toHaveAttribute('title', 'Listening — speak now');
  await expect(page.getByTestId('chat-voice')).toHaveClass(/btn-error/);

  socket?.send(JSON.stringify({ type: 'final', text: '幫我開張發票', duration_ms: 1200, elapsed_ms: 300, truncated: false }));

  await expect.poll(() => turns.some((frame) => frame.includes('幫我開張發票'))).toBe(true);
  await expect(page.getByTestId('chat-input')).toHaveText('');
  await expect(page.getByTestId('chat-voice')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('chat-voice')).toHaveAttribute('title', 'Listening for the wake word — click to stop');
});

test('shuts the wake mode off when the toggle is pressed again', async ({ page }) => {
  await mockBackend(page, { session: boss, sessions: [session], agents: [agent], providers: [provider] });
  await seedSession(page);

  await page.routeWebSocket(/\/agent-api\/voice\/ws/, (ws) => {
    ws.send(JSON.stringify({ type: 'ready', sample_rate: 16000, format: 'pcm_s16le', channels: 1, wake_word: true, vad: true }));
  });

  await page.goto(`/en/chat/${session.id}`);
  await expect(page.getByTestId('chat-page')).toBeAttached();

  await page.getByTestId('chat-voice').click();
  await expect(page.getByTestId('chat-voice')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('chat-voice').click();
  await expect(page.getByTestId('chat-voice')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('chat-mic')).toBeVisible();
});
