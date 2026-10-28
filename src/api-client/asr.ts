import { agentApiUrl } from '@/config/agentApi';
import { useAuthStore } from '@/stores/authStore';
import { refreshSession } from './runtime';

export const TRANSCRIBE_TIMEOUT_MS = 90_000;

const FILENAMES: Record<string, string> = {
  'audio/webm': 'speech.webm',
  'audio/ogg': 'speech.ogg',
  'audio/mp4': 'speech.mp4',
  'audio/mpeg': 'speech.mp3',
  'audio/wav': 'speech.wav',
};

export interface AsrResult {
  text: string;
  duration_ms: number;
  elapsed_ms: number;
}

export class AsrApiError extends Error {
  public readonly status: number;
  public readonly error: { code: string; message: string };

  public constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AsrApiError';
    this.status = status;
    this.error = { code, message };
  }
}

export function filenameFor(blob: Blob): string {
  const base = blob.type.split(';')[0].trim();
  return FILENAMES[base] ?? 'speech.webm';
}

function xhrTranscribe(file: Blob): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, filenameFor(file));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', agentApiUrl('/asr'));
    const token = useAuthStore().accessToken;
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.timeout = TRANSCRIBE_TIMEOUT_MS;
    xhr.ontimeout = () => reject(new AsrApiError(0, 'TIMEOUT', 'Transcription timed out.'));
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(new AsrApiError(0, 'NETWORK', 'Connection error. Please try again.'));
    xhr.send(form);
  });
}

async function xhrError(xhr: XMLHttpRequest): Promise<AsrApiError> {
  try {
    const body = JSON.parse(xhr.responseText) as { error?: { code?: string; message?: string } };
    return new AsrApiError(xhr.status, body.error?.code ?? `HTTP_${xhr.status}`, body.error?.message ?? xhr.statusText);
  } catch {
    return new AsrApiError(xhr.status, `HTTP_${xhr.status}`, xhr.statusText || 'Transcription failed.');
  }
}

export async function transcribeAudio(file: Blob): Promise<AsrResult> {
  let xhr = await xhrTranscribe(file);
  if (xhr.status === 401 && (await refreshSession())) {
    xhr = await xhrTranscribe(file);
  }
  if (xhr.status < 200 || xhr.status >= 300) {
    throw await xhrError(xhr);
  }
  return JSON.parse(xhr.responseText) as AsrResult;
}
