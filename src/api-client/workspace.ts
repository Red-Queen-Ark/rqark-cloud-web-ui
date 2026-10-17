import { agentApiUrl } from '@/config/agentApi';
import type { WorkspaceEntry, WorkspaceListing } from '@/config/workspace';
import { useAuthStore } from '@/stores/authStore';
import { fetchWithAuth } from './fetchWithAuth';
import { refreshSession } from './runtime';

export class WorkspaceApiError extends Error {
  public readonly status: number;
  public readonly error: { code: string; message: string };

  public constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'WorkspaceApiError';
    this.status = status;
    this.error = { code, message };
  }
}

export interface WorkspaceDownload {
  blob: Blob;
  filename: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
}

function queryPath(path: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ path });
  for (const [key, value] of Object.entries(extra)) {
    params.set(key, value);
  }
  return `?${params.toString()}`;
}

async function toApiError(response: Response): Promise<WorkspaceApiError> {
  let code = `HTTP_${response.status}`;
  let message = response.statusText || `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    return new WorkspaceApiError(response.status, code, message);
  }
  return new WorkspaceApiError(response.status, code, message);
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetchWithAuth(agentApiUrl(path), init);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response;
}

function filenameFrom(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return fallback;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

export async function listWorkspace(path: string, showHidden = false): Promise<WorkspaceListing> {
  const response = await request(`/workspace/list${queryPath(path, { show_hidden: String(showHidden) })}`);
  return (await response.json()) as WorkspaceListing;
}

export async function statWorkspace(path: string): Promise<WorkspaceEntry> {
  const response = await request(`/workspace/stat${queryPath(path)}`);
  return (await response.json()) as WorkspaceEntry;
}

async function download(path: string, fallbackName: string): Promise<WorkspaceDownload> {
  const response = await request(path);
  return { blob: await response.blob(), filename: filenameFrom(response.headers.get('Content-Disposition'), fallbackName) };
}

export function downloadWorkspaceFile(path: string, fallbackName: string): Promise<WorkspaceDownload> {
  return download(`/workspace/file${queryPath(path)}`, fallbackName);
}

export function downloadWorkspaceArchive(path: string, fallbackName: string): Promise<WorkspaceDownload> {
  return download(`/workspace/archive${queryPath(path)}`, fallbackName);
}

function xhrUpload(directory: string, files: File[], onProgress?: (progress: UploadProgress) => void): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file, file.name);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', agentApiUrl(`/workspace/upload${queryPath(directory)}`));
    const token = useAuthStore().accessToken;
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.upload.onprogress = (event) => onProgress?.({ loaded: event.loaded, total: event.total });
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(new WorkspaceApiError(0, 'NETWORK', 'Connection error. Please try again.'));
    xhr.onabort = () => reject(new WorkspaceApiError(0, 'ABORTED', 'Upload cancelled.'));
    xhr.send(form);
  });
}

async function xhrError(xhr: XMLHttpRequest): Promise<WorkspaceApiError> {
  try {
    const body = JSON.parse(xhr.responseText) as { error?: { code?: string; message?: string } };
    return new WorkspaceApiError(xhr.status, body.error?.code ?? `HTTP_${xhr.status}`, body.error?.message ?? xhr.statusText);
  } catch {
    return new WorkspaceApiError(xhr.status, `HTTP_${xhr.status}`, xhr.statusText || 'Upload failed.');
  }
}

export async function uploadWorkspaceFiles(directory: string, files: File[], onProgress?: (progress: UploadProgress) => void): Promise<WorkspaceEntry[]> {
  let xhr = await xhrUpload(directory, files, onProgress);
  if (xhr.status === 401 && (await refreshSession())) {
    xhr = await xhrUpload(directory, files, onProgress);
  }
  if (xhr.status < 200 || xhr.status >= 300) {
    throw await xhrError(xhr);
  }
  return (JSON.parse(xhr.responseText) as { entries: WorkspaceEntry[] }).entries;
}

export async function writeWorkspaceFile(path: string, content: string, ifUnmodifiedSince?: number): Promise<WorkspaceEntry> {
  const headers: Record<string, string> = { 'Content-Type': 'text/plain; charset=utf-8' };
  if (ifUnmodifiedSince !== undefined) {
    headers['If-Unmodified-Since'] = new Date(ifUnmodifiedSince * 1000).toUTCString();
  }
  const response = await request(`/workspace/file${queryPath(path)}`, { method: 'PUT', headers, body: content });
  return (await response.json()) as WorkspaceEntry;
}

export async function makeWorkspaceDirectory(path: string): Promise<WorkspaceEntry> {
  const response = await request(`/workspace/mkdir${queryPath(path)}`, { method: 'POST' });
  return (await response.json()) as WorkspaceEntry;
}

export async function moveWorkspaceEntry(path: string, newPath: string, overwrite = false): Promise<WorkspaceEntry> {
  const response = await request(`/workspace/file${queryPath(path, { overwrite: String(overwrite) })}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_path: newPath }),
  });
  return (await response.json()) as WorkspaceEntry;
}

export async function deleteWorkspaceEntry(path: string): Promise<void> {
  await request(`/workspace${queryPath(path)}`, { method: 'DELETE' });
}
