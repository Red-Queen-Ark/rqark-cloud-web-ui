import { refreshSession } from '@/api-client/runtime';
import { postAuthRefresh } from '@/api/sdk.gen';
import { useAuthStore } from '@/stores/authStore';
import { readTokenPair, writeTokenPair } from '@/utils/authSession';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@/api/sdk.gen', () => ({ postAuthRefresh: vi.fn() }));

describe('refreshSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('adopts the pair another tab already rotated instead of spending its own', async () => {
    // This tab still holds the token the other tab has since burned.
    useAuthStore().setTokens('old-access', 'spent-refresh');
    writeTokenPair({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    await expect(refreshSession()).resolves.toBe(true);

    expect(postAuthRefresh).not.toHaveBeenCalled();
    expect(useAuthStore().accessToken).toBe('new-access');
    expect(useAuthStore().refreshToken).toBe('new-refresh');
  });

  it('rotates once and publishes the replacement pair for the other tabs', async () => {
    useAuthStore().setTokens('old-access', 'old-refresh');
    (postAuthRefresh as Mock).mockResolvedValue({ data: { access_token: 'next-access', refresh_token: 'next-refresh' } });

    await expect(refreshSession()).resolves.toBe(true);

    expect(postAuthRefresh).toHaveBeenCalledTimes(1);
    expect(readTokenPair()).toEqual({ accessToken: 'next-access', refreshToken: 'next-refresh' });
    expect(useAuthStore().refreshToken).toBe('next-refresh');
  });

  it('deduplicates a burst of 401s inside the tab', async () => {
    useAuthStore().setTokens('old-access', 'old-refresh');
    (postAuthRefresh as Mock).mockResolvedValue({ data: { access_token: 'next-access', refresh_token: 'next-refresh' } });

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(results).toEqual([true, true, true]);
    expect(postAuthRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the refresh fails for transport reasons', async () => {
    useAuthStore().setTokens('old-access', 'old-refresh');
    (postAuthRefresh as Mock).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(refreshSession()).resolves.toBe(false);
    expect(useAuthStore().isAuthenticated).toBe(true);
    expect(readTokenPair()).toEqual({ accessToken: 'old-access', refreshToken: 'old-refresh' });
  });

  it('keeps the session when the backend answers with a 5xx', async () => {
    useAuthStore().setTokens('old-access', 'old-refresh');
    (postAuthRefresh as Mock).mockResolvedValue({ error: { error: 'boom' }, response: { status: 502 } });

    await expect(refreshSession()).resolves.toBe(false);
    expect(useAuthStore().isAuthenticated).toBe(true);
  });
});
