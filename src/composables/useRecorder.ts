import { computed, onScopeDispose, ref } from 'vue';
import { AsrApiError, transcribeAudio } from '@/api-client/asr';

export type RecorderState = 'idle' | 'recording' | 'transcribing';

export const RECORD_MAX_MS = 120_000;

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type));
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function recorderErrorKey(error: unknown): string {
  if (error instanceof AsrApiError) {
    switch (error.error.code) {
      case 'TIMEOUT':
      case 'ASR_TIMEOUT':
        return 'chat.micTimeout';
      case 'ASR_BUSY':
        return 'chat.micBusy';
      case 'AUDIO_TOO_LARGE':
      case 'AUDIO_TOO_LONG':
        return 'chat.micTooLong';
      case 'NETWORK':
        return 'chat.micNetwork';
      case 'AUDIO_EMPTY':
        return 'chat.micEmpty';
      default:
        return 'chat.micFailed';
    }
  }
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'chat.micDenied';
    }
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
      return 'chat.micMissing';
    }
  }
  return 'chat.micFailed';
}

export function useRecorder(onTranscript: (text: string) => void) {
  const state = ref<RecorderState>('idle');
  const errorKey = ref<string | null>(null);
  const elapsedMs = ref(0);

  const isRecording = computed(() => state.value === 'recording');
  const isTranscribing = computed(() => state.value === 'transcribing');

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let autoStop: ReturnType<typeof setTimeout> | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;

  function clearTimers() {
    if (autoStop !== undefined) {
      clearTimeout(autoStop);
      autoStop = undefined;
    }
    if (ticker !== undefined) {
      clearInterval(ticker);
      ticker = undefined;
    }
  }

  function release() {
    clearTimers();
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    recorder = null;
    chunks = [];
    elapsedMs.value = 0;
  }

  async function start() {
    errorKey.value = null;
    if (!canRecord()) {
      errorKey.value = 'chat.micUnsupported';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      errorKey.value = recorderErrorKey(error);
      release();
      return;
    }

    const mimeType = pickMimeType();
    const active = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder = active;
    chunks = [];
    const startedAt = Date.now();
    active.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    active.onstop = () => {
      void finish(active.mimeType, chunks);
    };
    active.start();
    state.value = 'recording';
    ticker = setInterval(() => {
      elapsedMs.value = Date.now() - startedAt;
    }, 200);
    autoStop = setTimeout(() => stop(), RECORD_MAX_MS);
  }

  async function finish(type: string, parts: Blob[]) {
    const blob = new Blob(parts, { type });
    release();
    if (blob.size === 0) {
      state.value = 'idle';
      return;
    }
    state.value = 'transcribing';
    try {
      const result = await transcribeAudio(blob);
      const text = result.text.trim();
      if (text) {
        onTranscript(text);
      } else {
        errorKey.value = 'chat.micEmpty';
      }
    } catch (error) {
      errorKey.value = recorderErrorKey(error);
    } finally {
      state.value = 'idle';
    }
  }

  function stop() {
    if (state.value !== 'recording' || !recorder) {
      return;
    }
    clearTimers();
    recorder.stop();
  }

  function cancel() {
    if (state.value !== 'recording') {
      return;
    }
    if (recorder) {
      recorder.onstop = null;
      recorder.stop();
    }
    release();
    state.value = 'idle';
  }

  async function toggle() {
    if (state.value === 'recording') {
      stop();
      return;
    }
    if (state.value === 'transcribing') {
      return;
    }
    await start();
  }

  function clearError() {
    errorKey.value = null;
  }

  onScopeDispose(() => {
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    release();
  });

  return { state, errorKey, elapsedMs, isRecording, isTranscribing, start, stop, cancel, toggle, clearError };
}
