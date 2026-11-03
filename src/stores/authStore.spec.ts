import * as api from '@/api';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useAuthStore } from './authStore';

vi.mock('@/api', () => ({
  getUsersMe: vi.fn(),
  patchUsersMe: vi.fn(),
  postAuthLogin: vi.fn(),
  postAuthRegister: vi.fn(),
  putUsersMePassword: vi.fn(),
}));

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('stores the token pair and the profile on login', async () => {
    (api.postAuthLogin as Mock).mockResolvedValue({ data: { access_token: 'access-1', refresh_token: 'refresh-1' } });
    (api.getUsersMe as Mock).mockResolvedValue({ data: { id: '1', username: 'boss', display_name: 'Boss' } });

    const store = useAuthStore();
    const result = await store.login({ login: 'boss', password: 'correct-horse-battery' });

    expect(result.ok).toBe(true);
    expect(store.accessToken).toBe('access-1');
    expect(store.refreshToken).toBe('refresh-1');
    expect(store.displayName).toBe('Boss');
    expect(store.isAuthenticated).toBe(true);
  });

  it('keeps no session when the credentials are rejected', async () => {
    (api.postAuthLogin as Mock).mockResolvedValue({ error: { error: { code: 'UNAUTHORIZED', message: 'Invalid' } } });

    const store = useAuthStore();
    const result = await store.login({ login: 'boss', password: 'wrong' });

    expect(result.ok).toBe(false);
    expect(store.accessToken).toBeUndefined();
    expect(store.isAuthenticated).toBe(false);
  });

  it('clears a persisted session the backend rejects', async () => {
    (api.getUsersMe as Mock).mockResolvedValue({ error: { error: { code: 'UNAUTHORIZED', message: 'Invalid' } } });

    const store = useAuthStore();
    store.setTokens('stale-access', 'stale-refresh');

    const restored = await store.restoreSession();

    expect(restored).toBe(false);
    expect(store.accessToken).toBeUndefined();
    expect(store.initialized).toBe(true);
  });

  it('marks the session initialized without a network call when no token is stored', async () => {
    const store = useAuthStore();

    const restored = await store.restoreSession();

    expect(restored).toBe(false);
    expect(api.getUsersMe).not.toHaveBeenCalled();
  });
});
