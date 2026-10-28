import { computed, onScopeDispose, ref } from 'vue';
import { refreshSession } from '@/api-client/runtime';
import { VOICE_CLOSE, VOICE_FINAL_TIMEOUT_MS, VOICE_READY_TIMEOUT_MS, voiceErrorKey, voiceSocketUrl, type VoiceEvent } from '@/api-client/voice-socket';
import { useAuthStore } from '@/stores/authStore';
import { PCM_TARGET_RATE, StreamResampler } from '@/utils/pcm';

export type VoiceStreamState = 'idle' | 'connecting' | 'armed' | 'listening' | 'stopping';

export type VoiceStreamMode = 'push' | 'wake';

const BLOCK_SIZE = 512;
const WORKLET_PATH = 'voice-pcm.worklet.js';

export function canStream(): boolean {
  return typeof window !== 'undefined' && typeof AudioContext !== 'undefined' && typeof AudioWorkletNode !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof WebSocket !== 'undefined';
}

function microphoneErrorKey(error: unknown): string {
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

export function useVoiceStream(onTranscript: (text: string, truncated: boolean, mode: VoiceStreamMode) => void) {
  const state = ref<VoiceStreamState>('idle');
  const errorKey = ref<string | null>(null);
  const mode = ref<VoiceStreamMode>('push');
  const wakeWord = ref<boolean | null>(null);
  const wakeScore = ref(0);
  const wakeName = ref('');
  const woke = ref(false);

  const isListening = computed(() => state.value === 'listening');
  const isArmed = computed(() => state.value === 'armed');
  const isBusy = computed(() => state.value === 'connecting' || state.value === 'stopping');
  const isOn = computed(() => state.value !== 'idle');

  let socket: WebSocket | null = null;
  let context: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let stream: MediaStream | null = null;
  let resampler: StreamResampler | null = null;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let finalTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers() {
    if (readyTimer !== undefined) {
      clearTimeout(readyTimer);
      readyTimer = undefined;
    }
    if (finalTimer !== undefined) {
      clearTimeout(finalTimer);
      finalTimer = undefined;
    }
  }

  function releaseAudio() {
    if (node) {
      node.port.onmessage = null;
      node.disconnect();
      node = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (context) {
      void context.close().catch(() => undefined);
      context = null;
    }
    resampler = null;
  }

  function releaseSocket() {
    const active = socket;
    socket = null;
    if (active && active.readyState <= WebSocket.OPEN) {
      active.onmessage = null;
      active.onclose = null;
      active.onerror = null;
      active.close();
    }
  }

  function teardown() {
    clearTimers();
    releaseAudio();
    releaseSocket();
    mode.value = 'push';
    woke.value = false;
    state.value = 'idle';
  }

  function fail(key: string) {
    errorKey.value = key;
    teardown();
  }

  function handleMessage(event: MessageEvent) {
    let payload: VoiceEvent;
    try {
      payload = JSON.parse(String(event.data)) as VoiceEvent;
    } catch {
      return;
    }
    if (payload.type === 'ready') {
      wakeWord.value = payload.wake_word;
      return;
    }
    if (payload.type === 'wake') {
      if (mode.value !== 'wake') {
        return;
      }
      wakeScore.value = payload.score;
      wakeName.value = payload.name ?? '';
      woke.value = true;
      errorKey.value = null;
      state.value = 'listening';
      return;
    }
    if (payload.type === 'final') {
      if (mode.value === 'wake' && !woke.value) {
        return;
      }
      const text = payload.text.trim();
      if (text) {
        onTranscript(text, payload.truncated, mode.value);
        errorKey.value = null;
      } else if (state.value !== 'armed') {
        errorKey.value = 'chat.micEmpty';
      }
      if (mode.value === 'wake') {
        woke.value = false;
        state.value = 'armed';
        return;
      }
      if (state.value === 'stopping') {
        teardown();
      }
      return;
    }
    if (payload.type === 'error') {
      if (mode.value === 'wake' && state.value !== 'connecting') {
        errorKey.value = voiceErrorKey(payload.error.code);
        woke.value = false;
        state.value = 'armed';
        return;
      }
      fail(voiceErrorKey(payload.error.code));
    }
  }

  function openSocket(token: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const opened = new WebSocket(voiceSocketUrl(token));
      opened.binaryType = 'arraybuffer';
      readyTimer = setTimeout(() => reject(new Error('VOICE_READY_TIMEOUT')), VOICE_READY_TIMEOUT_MS);
      opened.onerror = () => reject(new Error('VOICE_SOCKET_ERROR'));
      opened.onclose = (event) => reject(new Error(`VOICE_CLOSED_${event.code}`));
      opened.onmessage = (event) => {
        let payload: VoiceEvent;
        try {
          payload = JSON.parse(String(event.data)) as VoiceEvent;
        } catch {
          return;
        }
        if (payload.type !== 'ready') {
          return;
        }
        if (readyTimer !== undefined) {
          clearTimeout(readyTimer);
          readyTimer = undefined;
        }
        wakeWord.value = payload.wake_word;
        opened.onerror = null;
        opened.onclose = null;
        opened.onmessage = handleMessage;
        resolve(opened);
      };
    });
  }

  async function connect(token: string): Promise<WebSocket> {
    try {
      return await openSocket(token);
    } catch (error) {
      if (error instanceof Error && error.message === 'VOICE_CLOSED_4401' && (await refreshSession())) {
        return await openSocket(useAuthStore().accessToken ?? '');
      }
      throw error;
    }
  }

  function attachMicrophone(active: WebSocket) {
    const audio = new AudioContext();
    context = audio;
    const workletUrl = new URL(`${import.meta.env.BASE_URL}${WORKLET_PATH}`, window.location.origin).toString();
    return audio.audioWorklet
      .addModule(workletUrl)
      .then(() => navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }))
      .then((captured) => {
        stream = captured;
        source = audio.createMediaStreamSource(captured);
        node = new AudioWorkletNode(audio, 'pcm-block', { numberOfOutputs: 1, processorOptions: { blockSize: BLOCK_SIZE } });
        resampler = new StreamResampler(audio.sampleRate, PCM_TARGET_RATE);
        const mute = audio.createGain();
        mute.gain.value = 0;
        source.connect(node);
        node.connect(mute);
        mute.connect(audio.destination);
        node.port.onmessage = (message: MessageEvent<Float32Array>) => {
          if (!resampler || active.readyState !== WebSocket.OPEN) {
            return;
          }
          const pcm = resampler.push(message.data);
          if (pcm.length > 0) {
            active.send(pcm);
          }
        };
      });
  }

  async function start(next: VoiceStreamMode = 'push') {
    errorKey.value = null;
    if (!canStream()) {
      errorKey.value = 'chat.micUnsupported';
      return;
    }
    const token = useAuthStore().accessToken;
    if (!token) {
      errorKey.value = 'chat.micAuth';
      return;
    }

    mode.value = next;
    state.value = 'connecting';
    try {
      socket = await connect(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const closed = message.startsWith('VOICE_CLOSED_');
      if (closed && message.endsWith(String(VOICE_CLOSE.busy))) {
        fail('chat.micBusy');
      } else if (closed && message.endsWith(String(VOICE_CLOSE.unauthorized))) {
        fail('chat.micAuth');
      } else if (message === 'VOICE_READY_TIMEOUT') {
        fail('chat.micTimeout');
      } else {
        fail('chat.micNetwork');
      }
      return;
    }

    if (mode.value === 'wake') {
      socket.send(JSON.stringify({ type: 'mode', value: 'wake' }));
    }

    try {
      await attachMicrophone(socket);
    } catch (error) {
      fail(microphoneErrorKey(error));
      return;
    }
    if (mode.value === 'wake') {
      woke.value = false;
      state.value = 'armed';
      if (wakeWord.value === false) {
        errorKey.value = 'chat.voiceNoWakeWord';
      }
      return;
    }
    state.value = 'listening';
  }

  function stop() {
    if (mode.value === 'wake') {
      teardown();
      return;
    }
    if (state.value !== 'listening' || !socket) {
      return;
    }
    socket.send(JSON.stringify({ type: 'stop' }));
    state.value = 'stopping';
    finalTimer = setTimeout(teardown, VOICE_FINAL_TIMEOUT_MS);
  }

  function cancel() {
    if (state.value === 'idle') {
      return;
    }
    if (state.value === 'listening' && socket) {
      socket.send(JSON.stringify({ type: 'cancel' }));
    }
    teardown();
  }

  async function toggle() {
    if (state.value === 'listening') {
      stop();
      return;
    }
    if (state.value === 'idle') {
      await start('push');
    }
  }

  async function toggleWake() {
    if (mode.value === 'wake' && state.value !== 'idle') {
      teardown();
      return;
    }
    if (state.value === 'idle') {
      await start('wake');
    }
  }

  function clearError() {
    errorKey.value = null;
  }

  onScopeDispose(teardown);

  return { state, errorKey, mode, wakeWord, wakeScore, wakeName, woke, isListening, isArmed, isBusy, isOn, start, stop, cancel, toggle, toggleWake, clearError };
}
