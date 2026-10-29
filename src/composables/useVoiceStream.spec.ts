import { refreshSession } from '@/api-client/runtime';
import { useAuthStore } from '@/stores/authStore';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { effectScope, type EffectScope } from 'vue';
import { resetVoiceStream, useVoiceStream } from './useVoiceStream';

vi.mock('@/api-client/runtime', () => ({ refreshSession: vi.fn().mockResolvedValue(true) }));

class FakeSocket {
  public static OPEN = 1;
  public static CLOSED = 3;
  public static instances: FakeSocket[] = [];

  public url: string;
  public sent: (string | ArrayBuffer)[] = [];
  public readyState = FakeSocket.OPEN;
  public binaryType = 'blob';
  public onopen: (() => void) | null = null;
  public onclose: ((event: { code: number }) => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;

  public constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  public send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }

  public close() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code: 1000 });
  }

  public deliver(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  public serverClose(code: number) {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code });
  }
}

const stops: Mock[] = [];

class FakeAudioContext {
  public sampleRate = 48000;
  public destination = {};
  public closed = false;
  public audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };

  public createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }

  public createGain() {
    return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  }

  public close() {
    this.closed = true;
    return Promise.resolve();
  }
}

class FakeAudioWorkletNode {
  public static instances: FakeAudioWorkletNode[] = [];
  public port = { onmessage: null as ((event: { data: Float32Array }) => void) | null };
  public connected: unknown[] = [];

  public context: unknown;
  public name: string;
  public options: unknown;

  public constructor(context: unknown, name: string, options: unknown) {
    this.context = context;
    this.name = name;
    this.options = options;
    FakeAudioWorkletNode.instances.push(this);
  }

  public connect(target: unknown) {
    this.connected.push(target);
  }

  public disconnect() {
    return undefined;
  }

  public emit(samples: Float32Array) {
    this.port.onmessage?.({ data: samples });
  }
}

const onTranscript = vi.fn();

let scope: EffectScope;

function openStream() {
  let voice!: ReturnType<typeof useVoiceStream>;
  scope = effectScope();
  scope.run(() => {
    voice = useVoiceStream(onTranscript);
  });
  return voice;
}

function stubMicrophone(result?: () => Promise<unknown>) {
  const captured = result ?? (() => Promise.resolve({ getTracks: () => stops.map((stop) => ({ stop })) }));
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn().mockImplementation(captured) }, configurable: true });
}

async function started() {
  const voice = openStream();
  const pending = voice.start();
  await flushPromises();
  FakeSocket.instances.at(-1)?.deliver({ type: 'ready', sample_rate: 16000 });
  await pending;
  await flushPromises();
  return { voice, socket: FakeSocket.instances.at(-1) as FakeSocket, node: FakeAudioWorkletNode.instances.at(-1) as FakeAudioWorkletNode };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetVoiceStream();
  stops.length = 0;
  stops.push(vi.fn());
  FakeSocket.instances = [];
  FakeAudioWorkletNode.instances = [];
  setActivePinia(createPinia());
  useAuthStore().setTokens('access-token', 'refresh-token');
  (refreshSession as Mock).mockResolvedValue(true);
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
  stubMicrophone();
});

afterEach(() => {
  scope?.stop();
  resetVoiceStream();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('useVoiceStream', () => {
  it('opens the voice socket with the access token', async () => {
    const { socket } = await started();

    const url = new URL(socket.url);
    expect(url.pathname).toBe('/agent-api/voice/ws');
    expect(url.searchParams.get('token')).toBe('access-token');
  });

  it('reports listening once the server is ready', async () => {
    const { voice } = await started();

    expect(voice.state.value).toBe('listening');
    expect(voice.isListening.value).toBe(true);
  });

  it('streams the captured audio as 16k int16 frames', async () => {
    const { socket, node } = await started();

    node.emit(new Float32Array(4800).fill(0.5));

    expect(socket.sent).toHaveLength(1);
    const frame = socket.sent[0] as ArrayBuffer;
    expect(frame.byteLength).toBeGreaterThan(3000);
    expect(new Int16Array(frame)[0]).toBe(16384);
  });

  it('hands a finished utterance to the caller', async () => {
    const { socket, voice } = await started();

    socket.deliver({ type: 'final', text: ' 你好 ', duration_ms: 900, elapsed_ms: 200, truncated: false });
    await flushPromises();

    expect(onTranscript).toHaveBeenCalledWith('你好', false, 'push');
    expect(voice.state.value).toBe('listening');
  });

  it('does not pass on an empty transcript', async () => {
    const { socket, voice } = await started();

    socket.deliver({ type: 'final', text: '   ', duration_ms: 900, elapsed_ms: 200, truncated: false });
    await flushPromises();

    expect(onTranscript).not.toHaveBeenCalled();
    expect(voice.errorKey.value).toBe('chat.micEmpty');
  });

  it('asks the server to close the utterance and stops after the final', async () => {
    const { voice, socket } = await started();

    voice.stop();
    expect(socket.sent).toEqual([JSON.stringify({ type: 'stop' })]);
    expect(voice.state.value).toBe('stopping');

    socket.deliver({ type: 'final', text: '你好', duration_ms: 900, elapsed_ms: 200, truncated: false });
    await flushPromises();

    expect(voice.state.value).toBe('idle');
    expect(socket.readyState).toBe(FakeSocket.CLOSED);
  });

  it('reports a second connection as busy', async () => {
    const voice = openStream();
    const pending = voice.start();
    await flushPromises();
    FakeSocket.instances.at(-1)?.serverClose(4429);
    await pending;

    expect(voice.errorKey.value).toBe('chat.micBusy');
    expect(voice.state.value).toBe('idle');
  });

  it('reports an expired session when the token is refused and cannot be renewed', async () => {
    (refreshSession as Mock).mockResolvedValue(false);
    const voice = openStream();
    const pending = voice.start();
    await flushPromises();
    FakeSocket.instances.at(-1)?.serverClose(4401);
    await pending;

    expect(voice.errorKey.value).toBe('chat.micAuth');
  });

  it('retries once with the renewed token', async () => {
    (refreshSession as Mock).mockImplementation(async () => {
      useAuthStore().setTokens('fresh-token', 'refresh-token');
      return true;
    });
    const voice = openStream();
    const pending = voice.start();
    await flushPromises();
    FakeSocket.instances.at(-1)?.serverClose(4401);
    await flushPromises();

    expect(new URL((FakeSocket.instances.at(-1) as FakeSocket).url).searchParams.get('token')).toBe('fresh-token');
    FakeSocket.instances.at(-1)?.deliver({ type: 'ready', sample_rate: 16000 });
    await pending;

    expect(voice.state.value).toBe('listening');
  });

  it('reports a server side transcription failure', async () => {
    const { socket, voice } = await started();

    socket.deliver({ type: 'error', error: { code: 'ASR_TIMEOUT', message: 'slow' } });
    await flushPromises();

    expect(voice.errorKey.value).toBe('chat.micTimeout');
    expect(voice.state.value).toBe('idle');
  });

  it('reports a blocked microphone and closes the socket', async () => {
    stubMicrophone(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    const voice = openStream();
    const pending = voice.start();
    await flushPromises();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;
    socket.deliver({ type: 'ready', sample_rate: 16000 });
    await pending;
    await flushPromises();

    expect(voice.errorKey.value).toBe('chat.micDenied');
    expect(voice.state.value).toBe('idle');
    expect(socket.readyState).toBe(FakeSocket.CLOSED);
  });

  it('keeps the microphone when the component goes away', async () => {
    await started();

    scope.stop();

    expect(stops[0]).not.toHaveBeenCalled();
  });

  it('releases the microphone when the page goes away', async () => {
    await started();

    window.dispatchEvent(new Event('pagehide'));

    expect(stops[0]).toHaveBeenCalled();
  });

  it('sends nothing once the socket is closed', async () => {
    const { socket, node } = await started();

    socket.readyState = FakeSocket.CLOSED;
    node.emit(new Float32Array(4800).fill(0.5));

    expect(socket.sent).toHaveLength(0);
  });
});

describe('useVoiceStream wake mode', () => {
  async function armed() {
    const voice = openStream();
    const pending = voice.toggleWake();
    await flushPromises();
    FakeSocket.instances.at(-1)?.deliver({ type: 'ready', sample_rate: 16000, wake_word: true, vad: true });
    await pending;
    await flushPromises();
    return voice;
  }

  it('stays armed instead of listening until the wake word fires', async () => {
    const voice = await armed();

    expect(voice.state.value).toBe('armed');
    expect(voice.isListening.value).toBe(false);
    expect(voice.isOn.value).toBe(true);
  });

  it('switches to listening when the wake word fires', async () => {
    const voice = await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    socket.deliver({ type: 'wake', score: 0.91 });
    await flushPromises();

    expect(voice.state.value).toBe('listening');
    expect(voice.wakeScore.value).toBe(0.91);
  });

  it('remembers which wake word fired', async () => {
    const voice = await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    socket.deliver({ type: 'wake', score: 0.88, name: 'diana' });
    await flushPromises();

    expect(voice.wakeName.value).toBe('diana');
  });

  it('returns to armed after the utterance is transcribed', async () => {
    const voice = await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    socket.deliver({ type: 'wake', score: 0.9 });
    socket.deliver({ type: 'final', text: '開燈', duration_ms: 800, elapsed_ms: 300, truncated: false });
    await flushPromises();

    expect(onTranscript).toHaveBeenCalledWith('開燈', false, 'wake');
    expect(voice.state.value).toBe('armed');
    expect(voice.isOn.value).toBe(true);
  });

  it('keeps the socket and the microphone between utterances', async () => {
    await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    socket.deliver({ type: 'final', text: '開燈', duration_ms: 800, elapsed_ms: 300, truncated: false });
    await flushPromises();

    expect(socket.readyState).toBe(FakeSocket.OPEN);
    expect(stops[0]).not.toHaveBeenCalled();
  });

  it('warns but keeps streaming when no wake word is configured', async () => {
    const voice = openStream();
    const pending = voice.toggleWake();
    await flushPromises();
    FakeSocket.instances.at(-1)?.deliver({ type: 'ready', sample_rate: 16000, wake_word: false, vad: true });
    await pending;
    await flushPromises();

    expect(voice.errorKey.value).toBe('chat.voiceNoWakeWord');
    expect(voice.state.value).toBe('armed');
  });

  it('tells the server it wants the always-on mode before any audio', async () => {
    await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    expect(socket.sent[0]).toBe(JSON.stringify({ type: 'mode', value: 'wake' }));
  });

  it('turns the always-on mode off when toggled again', async () => {
    const voice = await armed();

    await voice.toggleWake();

    expect(voice.state.value).toBe('idle');
    expect(stops[0]).toHaveBeenCalled();
  });

  it('keeps the push to talk mode listening when a wake event arrives', async () => {
    const { voice, socket } = await started();

    socket.deliver({ type: 'wake', score: 0.99 });
    await flushPromises();

    expect(voice.mode.value).toBe('push');
    expect(voice.state.value).toBe('listening');
  });
});

describe('useVoiceStream wake hold', () => {
  async function armed() {
    const voice = openStream();
    const pending = voice.toggleWake();
    await flushPromises();
    FakeSocket.instances.at(-1)?.deliver({ type: 'ready', sample_rate: 16000, wake_word: true, vad: true });
    await pending;
    await flushPromises();
    return voice;
  }

  it('drops a transcript that arrives before the wake word', async () => {
    const voice = await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    socket.deliver({ type: 'final', text: 'Hey Wednesday', duration_ms: 900, elapsed_ms: 200, truncated: false });
    await flushPromises();

    expect(onTranscript).not.toHaveBeenCalled();
    expect(voice.state.value).toBe('armed');
  });

  it('flags the button as listening only after the wake word', async () => {
    const voice = await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    expect(voice.woke.value).toBe(false);
    socket.deliver({ type: 'wake', score: 0.81 });
    await flushPromises();
    expect(voice.woke.value).toBe(true);
    expect(voice.state.value).toBe('listening');
  });

  it('forgets the wake once the turn is done', async () => {
    const voice = await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    socket.deliver({ type: 'wake', score: 0.81 });
    socket.deliver({ type: 'final', text: '開燈', duration_ms: 800, elapsed_ms: 300, truncated: false });
    await flushPromises();

    expect(voice.woke.value).toBe(false);
    expect(onTranscript).toHaveBeenCalledTimes(1);
  });

  it('ignores a stray transcript after the turn', async () => {
    await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    socket.deliver({ type: 'wake', score: 0.81 });
    socket.deliver({ type: 'final', text: '開燈', duration_ms: 800, elapsed_ms: 300, truncated: false });
    socket.deliver({ type: 'final', text: '再開一次', duration_ms: 800, elapsed_ms: 300, truncated: false });
    await flushPromises();

    expect(onTranscript).toHaveBeenCalledTimes(1);
  });
});

describe('useVoiceStream persistence', () => {
  it('hands the running session to the next component', async () => {
    const { voice: first } = await started();
    scope.stop();

    const second = openStream();

    expect(second.state.value).toBe('listening');
    expect(second.isOn.value).toBe(true);
    expect(first.state.value).toBe('listening');
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('keeps the latest caller as the transcript handler', async () => {
    const { socket } = await started();
    const later = vi.fn();
    scope.stop();
    let rebound!: ReturnType<typeof useVoiceStream>;
    scope = effectScope();
    scope.run(() => {
      rebound = useVoiceStream(later);
    });

    socket.deliver({ type: 'final', text: '你好', duration_ms: 900, elapsed_ms: 200, truncated: false });
    await flushPromises();

    expect(later).toHaveBeenCalledWith('你好', false, 'push');
    expect(rebound.state.value).toBe('listening');
  });
});

describe('useVoiceStream wake recovery', () => {
  async function armed() {
    const voice = openStream();
    const pending = voice.toggleWake();
    await flushPromises();
    FakeSocket.instances.at(-1)?.deliver({ type: 'ready', sample_rate: 16000, wake_word: true, vad: true });
    await pending;
    await flushPromises();
    return voice;
  }

  it('stays on when the server reports an error while armed', async () => {
    const voice = await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    socket.deliver({ type: 'error', error: { code: 'VOICE_WAKE_TIMEOUT', message: 'nothing followed' } });
    await flushPromises();

    expect(voice.state.value).toBe('armed');
    expect(voice.isOn.value).toBe(true);
    expect(voice.errorKey.value).toBe('chat.voiceWakeTimeout');
  });

  it('reconnects instead of switching off when the socket drops', async () => {
    const voice = await armed();
    const socket = FakeSocket.instances.at(-1) as FakeSocket;

    socket.serverClose(1009);
    await flushPromises();

    expect(voice.isOn.value).toBe(true);
    expect(voice.state.value).toBe('connecting');
  });
});
