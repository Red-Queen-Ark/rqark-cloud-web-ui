import * as api from '@/api';
import * as asr from '@/api-client/asr';
import { i18n } from '@/i18n';
import type { ChatStatus } from '@/config/chatStatus';
import { resetSopList } from '@/composables/useSopList';
import { resetSpeechAvailability } from '@/composables/useSpeechAvailability';
import { resetVoiceStream } from '@/composables/useVoiceStream';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { nextTick } from 'vue';
import ChatInputArea from './ChatInputArea.vue';

vi.mock('@/api', () => ({
  getSops: vi.fn(),
}));

vi.mock('@/api-client/asr', async () => {
  const actual = await vi.importActual<typeof import('@/api-client/asr')>('@/api-client/asr');
  return { ...actual, transcribeAudio: vi.fn() };
});

class FakeMediaRecorder {
  public static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus';
  public state: 'inactive' | 'recording' = 'inactive';
  public mimeType = 'audio/webm;codecs=opus';
  public ondataavailable: ((event: { data: Blob }) => void) | null = null;
  public onstop: (() => void) | null = null;

  public start() {
    this.state = 'recording';
  }

  public stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  resetSopList();
  resetSpeechAvailability();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  setActivePinia(createPinia());
  (api.getSops as Mock).mockResolvedValue({ data: { items: [{ slug: 'trip-itinerary', title: 'Trip itinerary' }] } });
});

function mountArea(overrides: { agents?: string[]; initialAgent?: string; defaultAgent?: string; providers?: { name?: string; model_name?: string }[]; status?: ChatStatus; streaming?: boolean } = {}) {
  return mount(ChatInputArea, {
    props: {
      agents: overrides.agents ?? ['researcher'],
      initialAgent: overrides.initialAgent,
      defaultAgent: overrides.defaultAgent,
      providers: overrides.providers ?? [{ name: 'openai', model_name: 'gpt-5' }],
      status: overrides.status,
      streaming: overrides.streaming,
    },
    global: { plugins: [i18n] },
  });
}

/** A mounted input whose speech probe has already answered, as the network would. */
async function mountReadyArea(overrides: Parameters<typeof mountArea>[0] = {}) {
  const wrapper = mountArea(overrides);
  await flushPromises();
  return wrapper;
}

describe('ChatInputArea', () => {
  it('shows no status dot before a connection', () => {
    expect(mountArea().find('.status').exists()).toBe(false);
  });

  it('shows a warning dot while connecting', () => {
    expect(mountArea({ status: 'connecting' }).get('.status').classes()).toContain('status-warning');
  });

  it('shows a success dot once connected', () => {
    expect(mountArea({ status: 'connected' }).get('.status').classes()).toContain('status-success');
  });

  it('shows an error dot when the connection dropped', () => {
    expect(mountArea({ status: 'error' }).get('.status').classes()).toContain('status-error');
  });

  it('keeps send disabled until something is typed', async () => {
    const wrapper = mountArea();
    const send = wrapper.get('[data-testid="chat-send"]');
    expect(send.attributes('disabled')).toBeDefined();

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hi';
    await input.trigger('input');

    expect(send.attributes('disabled')).toBeUndefined();
  });

  it('emits the typed turn with the chosen agent and provider', async () => {
    const wrapper = mountArea();

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ content: 'hello', agent: 'researcher', provider: 'openai', images: [] }]);
  });

  async function attach(wrapper: ReturnType<typeof mountArea>, files: File[]) {
    const input = wrapper.get('[data-testid="chat-image-input"]');
    Object.defineProperty(input.element, 'files', { value: files, configurable: true });
    await input.trigger('change');
    await flushPromises();
    // FileReader resolves off the microtask queue, so give it a macrotask.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function imageFile(name = 'a.png', type = 'image/png', bytes = 4) {
    return new File([new Uint8Array(bytes)], name, { type });
  }

  it('offers a camera input for a phone to open straight into the camera', () => {
    expect(mountArea().get('[data-testid="chat-camera-input"]').attributes('capture')).toBe('environment');
  });

  it('attaches a picked image and sends it with the turn', async () => {
    const wrapper = mountArea();
    await attach(wrapper, [imageFile()]);

    expect(wrapper.findAll('[data-testid="chat-image-remove"]')).toHaveLength(1);
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    const payload = wrapper.emitted('submit')?.[0]?.[0] as { content: string; images: string[] };
    expect(payload.images).toHaveLength(1);
    expect(payload.images[0]).toMatch(/^data:image\/png;base64,/);
  });

  it('sends an image on its own without any text', async () => {
    const wrapper = mountArea();
    await attach(wrapper, [imageFile()]);

    expect(wrapper.get('[data-testid="chat-send"]').attributes('disabled')).toBeUndefined();
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    const payload = wrapper.emitted('submit')?.[0]?.[0] as { content: string; images: string[] };
    expect(payload.content).toBe('');
    expect(payload.images).toHaveLength(1);
  });

  it('keeps an over-sized photo as a failed tile that can be retried', async () => {
    const wrapper = mountArea();
    const alertStore = useAlertStore();
    await attach(wrapper, [imageFile('big.png', 'image/png', 5 * 1024 * 1024 + 1)]);

    expect(wrapper.findAll('[data-testid="chat-image"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="chat-image-retry"]').exists()).toBe(true);
    expect(alertStore.alertList.map((item) => item.level)).toEqual(['error']);
  });

  it('refuses an unsupported image type', async () => {
    const wrapper = mountArea();
    const alertStore = useAlertStore();
    await attach(wrapper, [imageFile('a.svg', 'image/svg+xml')]);

    expect(wrapper.find('[data-testid="chat-image-remove"]').exists()).toBe(false);
    expect(alertStore.alertList.map((item) => item.level)).toEqual(['error']);
  });

  it('reports a file the browser refuses to read instead of throwing', async () => {
    const wrapper = mountArea();
    const alertStore = useAlertStore();
    class FailingReader {
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public result: string | null = null;
      public readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', FailingReader);
    const file = imageFile();
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.reject(new Error('unreadable')) });

    await attach(wrapper, [file]);

    expect(wrapper.find('[data-testid="chat-image-retry"]').exists()).toBe(true);
    expect(alertStore.alertList.map((item) => item.level)).toEqual(['error']);
  });

  it('falls back to reading the bytes when the file reader refuses', async () => {
    const wrapper = mountArea();
    class RefusingReader {
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public result: string | null = null;
      public readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', RefusingReader);
    const file = imageFile();
    // jsdom has no working Blob.arrayBuffer, so the bytes are supplied here.
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer) });

    await attach(wrapper, [file]);

    expect(wrapper.findAll('[data-testid="chat-image-remove"]')).toHaveLength(1);
  });

  it('names an unreadable file as such rather than a generic failure', async () => {
    const wrapper = mountArea();
    const alertStore = useAlertStore();
    class UnreadableReader {
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public result: string | null = null;
      public error = Object.assign(new Error('nope'), { name: 'NotReadableError' });
      public readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', UnreadableReader);
    const file = imageFile();
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.reject(Object.assign(new Error('nope'), { name: 'NotReadableError' })) });

    await attach(wrapper, [file]);

    expect(alertStore.alertList.at(-1)?.message).toBe('Could not read this image. Download it from the cloud to this device first');
  });

  it('releases the picked file only after it has been read', async () => {
    const wrapper = mountArea();
    const seen: string[] = [];
    const input = wrapper.get('[data-testid="chat-image-input"]');
    Object.defineProperty(input.element, 'value', {
      get: () => '',
      set: (value: string) => seen.push(`clear:${value}`),
      configurable: true,
    });

    await attach(wrapper, [imageFile()]);

    // The read has already resolved by the time the input is reset, so Safari
    // still has a live reference while it decodes the file.
    expect(wrapper.findAll('[data-testid="chat-image-remove"]')).toHaveLength(1);
    expect(seen).toEqual(['clear:']);
  });

  it('drops an attached image once the turn has been sent', async () => {
    const wrapper = mountArea();
    await attach(wrapper, [imageFile()]);
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    wrapper.vm.clear();
    await nextTick();

    expect(wrapper.find('[data-testid="chat-image-remove"]').exists()).toBe(false);
  });

  it('falls back to the model name for a provider without a name', async () => {
    const wrapper = mountArea({ providers: [{ model_name: 'gpt-5' }] });

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ content: 'hello', agent: 'researcher', provider: 'gpt-5', images: [] }]);
  });

  async function submitWith(wrapper: ReturnType<typeof mountArea>): Promise<unknown> {
    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');
    return wrapper.emitted('submit')?.[0];
  }

  function agentSelect(wrapper: ReturnType<typeof mountArea>) {
    // The provider picker comes first in the toolbar.
    return wrapper.findAll('select')[1];
  }

  it('starts on the stored default agent when there is one', async () => {
    const wrapper = mountArea({ agents: ['researcher', 'writer'], defaultAgent: 'writer' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('writer');
    expect(await submitWith(wrapper)).toEqual([{ content: 'hello', agent: 'writer', provider: 'openai', images: [] }]);
  });

  it('falls back to the first agent when the stored default is not on offer', async () => {
    const wrapper = mountArea({ agents: ['researcher', 'writer'], defaultAgent: 'deleted-since' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('researcher');
  });

  it('keeps a hand-picked agent when the default arrives after it', async () => {
    const wrapper = mountArea({ agents: ['researcher', 'writer'] });

    await agentSelect(wrapper).setValue('writer');
    // The default is read on its own request, so it can land after the user has
    // already chosen; the choice is the newer intent of the two.
    await wrapper.setProps({ defaultAgent: 'researcher' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('writer');
  });

  it("starts on the chat's own agent rather than the stored default", async () => {
    const wrapper = mountArea({ agents: ['researcher', 'writer'], initialAgent: 'writer', defaultAgent: 'researcher' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('writer');
  });

  it("moves to the chat's own agent when it arrives after the mount", async () => {
    const wrapper = mountArea({ agents: ['researcher', 'writer'] });

    // A chat started from the home page mounts before the turn it was handed
    // over has been read, so the agent can land a tick later.
    await wrapper.setProps({ initialAgent: 'writer' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('writer');
  });

  it('moves to the stored default when it changes the agent list', async () => {
    const wrapper = mountArea({ agents: ['researcher'], defaultAgent: 'researcher' });

    await wrapper.setProps({ agents: ['researcher', 'writer'], defaultAgent: 'writer' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('writer');
  });

  it('clears the editor and disables send when the parent asks', async () => {
    const wrapper = mountArea();

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');

    const area = wrapper.vm as unknown as { clear: () => void };
    area.clear();
    await nextTick();

    expect(input.element.textContent).toBe('');
    expect(wrapper.get('[data-testid="chat-send"]').attributes('disabled')).toBeDefined();
  });

  it('replaces send with stop while a turn is in flight', async () => {
    const wrapper = mountArea({ streaming: true });

    expect(wrapper.find('[data-testid="chat-send"]').exists()).toBe(false);

    await wrapper.get('[data-testid="chat-stop"]').trigger('click');

    expect(wrapper.emitted('stop')).toHaveLength(1);
  });
});

describe('ChatInputArea slash panel', () => {
  async function typeInto(wrapper: ReturnType<typeof mountArea>, text: string) {
    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = text;
    await input.trigger('input');
    return input;
  }

  async function openWithSlash(wrapper: ReturnType<typeof mountArea>) {
    await nextTick();
    await nextTick();
    return typeInto(wrapper, '/');
  }

  it('opens on a slash and lists the built-in commands and the sops', async () => {
    const wrapper = mountArea();
    await openWithSlash(wrapper);

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slash-option-compact"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slash-option-stop"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slash-option-trip-itinerary"]').exists()).toBe(true);
  });

  it('narrows the list as more is typed', async () => {
    const wrapper = mountArea();
    await openWithSlash(wrapper);

    await typeInto(wrapper, '/trip');

    expect(wrapper.findAll('[role="option"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="slash-option-trip-itinerary"]').exists()).toBe(true);
  });

  it('closes once the text has a space', async () => {
    const wrapper = mountArea();
    await openWithSlash(wrapper);

    await typeInto(wrapper, '/stop now');

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);
  });

  it('stays closed while an IME is composing', async () => {
    const wrapper = mountArea();
    await nextTick();
    const input = wrapper.get('[data-testid="chat-input"]');

    await input.trigger('compositionstart');
    await typeInto(wrapper, '/trip');

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);

    await input.trigger('compositionend');
    await nextTick();

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(true);
  });

  it('completes the highlighted sop on Enter without sending the turn', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/trip');
    await input.trigger('keydown', { key: 'Enter' });

    expect(input.element.textContent).toBe('/trip-itinerary ');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);
  });

  it('completes on Tab too', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/com');
    await input.trigger('keydown', { key: 'Tab' });

    expect(input.element.textContent).toBe('/compact ');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('moves the highlight with the arrow keys and wraps around', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/');
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.get('[data-testid="slash-option-stop"]').attributes('aria-selected')).toBe('true');

    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.get('[data-testid="slash-option-trip-itinerary"]').attributes('aria-selected')).toBe('true');

    await input.trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.get('[data-testid="slash-option-stop"]').attributes('aria-selected')).toBe('true');
  });

  it('wraps the highlight from the last row to the first and back', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/');
    await input.trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.get('[data-testid="slash-option-trip-itinerary"]').attributes('aria-selected')).toBe('true');

    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.get('[data-testid="slash-option-compact"]').attributes('aria-selected')).toBe('true');
  });

  it('closes on Escape and leaves the text alone', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await input.trigger('keydown', { key: 'Escape' });

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);
    expect(input.element.textContent).toBe('/');
  });

  it('completes the row the mouse clicks', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/trip');
    await wrapper.get('[data-testid="slash-option-trip-itinerary"]').trigger('click');

    expect(input.element.textContent).toBe('/trip-itinerary ');
  });

  it('still offers the built-in commands when the sop read fails', async () => {
    (api.getSops as Mock).mockResolvedValue({ error: { error: { code: 'NOT_FOUND', message: 'Not found.' } } });
    const wrapper = mountArea();

    await openWithSlash(wrapper);

    expect(wrapper.find('[data-testid="slash-option-compact"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slash-option-trip-itinerary"]').exists()).toBe(false);
  });
  it('does not reopen once an argument follows the completed slug', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/trip');
    await input.trigger('keydown', { key: 'Enter' });
    await typeInto(wrapper, '/trip-itinerary 大阪');

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);
  });
});

describe('ChatInputArea voice input', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
      configurable: true,
    });
    (asr.transcribeAudio as Mock).mockResolvedValue({ text: '你好世界', duration_ms: 900, elapsed_ms: 300 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('hides the mic where the browser cannot record', async () => {
    Reflect.deleteProperty(navigator, 'mediaDevices');

    const wrapper = await mountReadyArea();

    expect(wrapper.find('[data-testid="chat-mic"]').exists()).toBe(false);
  });

  it('hides both voice controls when the server switches speech off', async () => {
    resetSpeechAvailability();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const wrapper = await mountReadyArea();
    await flushPromises();

    expect(wrapper.find('[data-testid="chat-voice"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="chat-mic"]').exists()).toBe(false);
  });

  it('offers the voice controls once the server confirms speech is mounted', async () => {
    const wrapper = await mountReadyArea();
    await flushPromises();

    expect(wrapper.find('[data-testid="chat-voice"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="chat-mic"]').exists()).toBe(true);
  });

  it('drops the transcript into the editor and enables send', async () => {
    const wrapper = await mountReadyArea();

    await wrapper.get('[data-testid="chat-mic"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="chat-mic"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="chat-input"]').element.textContent).toBe('你好世界');
    expect(wrapper.get('[data-testid="chat-send"]').attributes('disabled')).toBeUndefined();
  });

  it('appends the transcript after what the user already typed', async () => {
    const wrapper = await mountReadyArea();
    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = '幫我';
    await input.trigger('input');

    await wrapper.get('[data-testid="chat-mic"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="chat-mic"]').trigger('click');
    await flushPromises();

    expect(input.element.textContent).toBe('幫我 你好世界');
  });

  it('reports a transcription failure through the alert stack', async () => {
    (asr.transcribeAudio as Mock).mockRejectedValue(new asr.AsrApiError(429, 'ASR_BUSY', 'busy'));
    const wrapper = await mountReadyArea();

    await wrapper.get('[data-testid="chat-mic"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="chat-mic"]').trigger('click');
    await flushPromises();

    const alerts = useAlertStore().alertList;
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ level: 'error', message: 'The transcriber is busy, try again shortly' });
    expect(wrapper.find('[data-testid="chat-mic-error"]').exists()).toBe(false);
  });
});

describe('ChatInputArea voice streaming', () => {
  class Socket {
    public static OPEN = 1;
    public static instances: Socket[] = [];
    public url: string;
    public readyState = Socket.OPEN;
    public sent: unknown[] = [];
    public onmessage: ((event: { data: string }) => void) | null = null;
    public onclose: ((event: { code: number }) => void) | null = null;
    public onerror: (() => void) | null = null;

    public constructor(url: string) {
      this.url = url;
      Socket.instances.push(this);
    }

    public send(data: unknown) {
      this.sent.push(data);
    }

    public close() {
      this.readyState = 3;
    }
  }

  class Context {
    public sampleRate = 48000;
    public destination = {};
    public audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
    public createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }
    public createGain() {
      return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    }
    public close() {
      return Promise.resolve();
    }
  }

  class WorkletNode {
    public port: { onmessage: ((event: { data: Float32Array }) => void) | null } = { onmessage: null };
    public connect() {
      return undefined;
    }
    public disconnect() {
      return undefined;
    }
  }

  const track = { stop: vi.fn() };

  beforeEach(() => {
    resetVoiceStream();
    Socket.instances = [];
    vi.stubGlobal('WebSocket', Socket);
    vi.stubGlobal('AudioContext', Context);
    vi.stubGlobal('AudioWorkletNode', WorkletNode);
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) }, configurable: true });
  });

  afterEach(() => {
    resetVoiceStream();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  async function mountWithPinia() {
    const pinia = createPinia();
    setActivePinia(pinia);
    useAuthStore().setTokens('access-token', 'refresh-token');
    const wrapper = mount(ChatInputArea, {
      props: { agents: ['researcher'], providers: [{ name: 'openai', model_name: 'gpt-5' }] },
      global: { plugins: [i18n, pinia] },
    });
    await flushPromises();
    return wrapper;
  }

  it('opens the voice socket on the first press', async () => {
    const wrapper = await mountWithPinia();

    await wrapper.get('[data-testid="chat-mic"]').trigger('click');
    await flushPromises();

    expect(Socket.instances.map((socket) => new URL(socket.url).pathname)).toEqual(['/agent-api/voice/ws']);
  });

  it('marks the button as pressed once the stream is live', async () => {
    const wrapper = await mountWithPinia();

    await wrapper.get('[data-testid="chat-mic"]').trigger('click');
    await flushPromises();
    Socket.instances[0].onmessage?.({ data: JSON.stringify({ type: 'ready' }) });
    await flushPromises();

    expect(wrapper.get('[data-testid="chat-mic"]').attributes('aria-pressed')).toBe('true');
  });

  it('asks the server to close the utterance on the second press', async () => {
    const wrapper = await mountWithPinia();

    await wrapper.get('[data-testid="chat-mic"]').trigger('click');
    await flushPromises();
    Socket.instances[0].onmessage?.({ data: JSON.stringify({ type: 'ready' }) });
    await flushPromises();
    await wrapper.get('[data-testid="chat-mic"]').trigger('click');

    expect(Socket.instances[0].sent).toEqual([JSON.stringify({ type: 'stop' })]);
  });
});
