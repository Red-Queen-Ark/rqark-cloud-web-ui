import { fetchWithAuth } from '@/api-client/fetchWithAuth';
import { refreshSession } from '@/api-client/runtime';
import { useAuthStore } from '@/stores/authStore';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@/api-client/runtime', () => ({ refreshSession: vi.fn() }));

function authHeaderOf(call: unknown[]): string | null {
  const init = call[1] as RequestInit;
  return new Headers(init.headers).get('Authorization');
}

describe('fetchWithAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    useAuthStore().setTokens('access-token', 'refresh-token');
    (refreshSession as Mock).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends the current access token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithAuth('/agent-api/chat/session-a/replay');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe('Bearer access-token');
  });

  it('rotates the token and retries once when the request is rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ status: 401 }).mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    (refreshSession as Mock).mockImplementation(async () => {
      useAuthStore().setTokens('rotated-token', 'rotated-refresh');
      return true;
    });

    const response = await fetchWithAuth('/agent-api/chat/session-a/replay');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe('Bearer access-token');
    expect(authHeaderOf(fetchMock.mock.calls[1])).toBe('Bearer rotated-token');
  });

  it('gives up when the token cannot be rotated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithAuth('/agent-api/chat/session-a/replay');

    expect(response.status).toBe(401);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the request body and method on the retry', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ status: 401 }).mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    (refreshSession as Mock).mockResolvedValue(true);

    await fetchWithAuth('/agent-api/chat/session-a/revert', { method: 'POST', body: '{"message_id":"m2"}' });

    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"message_id":"m2"}');
  });
});
