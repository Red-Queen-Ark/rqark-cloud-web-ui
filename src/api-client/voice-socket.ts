import { agentApiUrl } from '@/config/agentApi';

export const VOICE_CLOSE = {
  unauthorized: 4401,
  idle: 4408,
  busy: 4429,
} as const;

export const VOICE_READY_TIMEOUT_MS = 10_000;
export const VOICE_FINAL_TIMEOUT_MS = 20_000;

export interface VoiceReadyEvent {
  type: 'ready';
  sample_rate: number;
  format: string;
  channels: number;
  max_seconds: number;
  wake_word: boolean;
  wake_models?: string[];
  vad: boolean;
}

export interface VoiceFinalEvent {
  type: 'final';
  text: string;
  duration_ms: number;
  elapsed_ms: number;
  truncated: boolean;
}

export interface VoiceWakeEvent {
  type: 'wake';
  score: number;
  name?: string;
}

export interface VoiceErrorEvent {
  type: 'error';
  error: { code: string; message: string };
}

export type VoiceEvent = VoiceReadyEvent | VoiceFinalEvent | VoiceWakeEvent | VoiceErrorEvent | { type: 'started' };

export function voiceSocketUrl(token: string): string {
  const url = new URL(agentApiUrl('/voice/ws'), window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
}

export function voiceErrorKey(code: string): string {
  switch (code) {
    case 'VOICE_BUSY':
      return 'chat.micBusy';
    case 'VOICE_IDLE':
      return 'chat.micIdle';
    case 'AUDIO_TOO_LARGE':
    case 'AUDIO_TOO_LONG':
      return 'chat.micTooLong';
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return 'chat.micAuth';
    case 'ASR_BUSY':
      return 'chat.micBusy';
    case 'ASR_TIMEOUT':
      return 'chat.micTimeout';
    case 'ASR_UNAVAILABLE':
    case 'VAD_UNAVAILABLE':
      return 'chat.micUnavailable';
    case 'VOICE_WAKE_TIMEOUT':
      return 'chat.voiceWakeTimeout';
    case 'AUDIO_EMPTY':
      return 'chat.micEmpty';
    default:
      return 'chat.micFailed';
  }
}
