import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { defineComponent } from 'vue';
import { AsrApiError, transcribeAudio } from '@/api-client/asr';
import { useRecorder } from './useRecorder';

vi.mock('@/api-client/asr', async () => {
  const actual = await vi.importActual<typeof import('@/api-client/asr')>('@/api-client/asr');
  return { ...actual, transcribeAudio: vi.fn() };
});

class FakeMediaRecorder {
  public static instances: FakeMediaRecorder[] = [];
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

const onTranscript = vi.fn();

function mountHost() {
  let recorder!: ReturnType<typeof useRecorder>;
  const Host = defineComponent({
    setup() {
      recorder = useRecorder(onTranscript);
      return () => null;
    },
  });
  mount(Host);
  return recorder;
}

function stubMicrophone(result: Promise<unknown> = Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] })) {
  const getUserMedia = vi.fn().mockReturnValue(result);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  return getUserMedia;
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeMediaRecorder.instances = [];
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  (transcribeAudio as Mock).mockResolvedValue({ text: ' 你好 ', duration_ms: 1200, elapsed_ms: 400 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('useRecorder', () => {
  it('records and hands the transcript back', async () => {
    stubMicrophone();
    const recorder = mountHost();

    await recorder.toggle();
    expect(recorder.state.value).toBe('recording');

    recorder.stop();
    await flushPromises();

    expect(transcribeAudio).toHaveBeenCalledOnce();
    expect(onTranscript).toHaveBeenCalledWith('你好');
    expect(recorder.state.value).toBe('idle');
  });

  it('reports a blocked microphone and stays idle', async () => {
    stubMicrophone(Promise.reject(new DOMException('denied', 'NotAllowedError')));
    const recorder = mountHost();

    await recorder.toggle();

    expect(recorder.errorKey.value).toBe('chat.micDenied');
    expect(recorder.state.value).toBe('idle');
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it('reports an unsupported browser', async () => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
    const recorder = mountHost();

    await recorder.toggle();

    expect(recorder.errorKey.value).toBe('chat.micUnsupported');
  });

  it('maps a busy transcriber to a retry hint', async () => {
    stubMicrophone();
    (transcribeAudio as Mock).mockRejectedValue(new AsrApiError(429, 'ASR_BUSY', 'busy'));
    const recorder = mountHost();

    await recorder.toggle();
    recorder.stop();
    await flushPromises();

    expect(recorder.errorKey.value).toBe('chat.micBusy');
    expect(onTranscript).not.toHaveBeenCalled();
    expect(recorder.state.value).toBe('idle');
  });

  it('drops the recording when cancelled', async () => {
    stubMicrophone();
    const recorder = mountHost();

    await recorder.toggle();
    recorder.cancel();
    await flushPromises();

    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(recorder.state.value).toBe('idle');
  });
});
