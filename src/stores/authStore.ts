import type { ApiLoginRequest, ApiRegisterRequest, ApiUserDto } from '@/api';
import { getUsersMe, patchUsersMe, postAuthLogin, postAuthRegister, putUsersMePassword } from '@/api';
import type { ApiChangePasswordRequest, ApiUpdateMeRequest } from '@/api';
import { defineStore } from 'pinia';

/** The outcome of an action that can be rejected by the backend. */
export interface AuthResult {
  ok: boolean;
  /** The parsed error body (or transport error) when `ok` is false. */
  error?: unknown;
}

export const useAuthStore = defineStore('authStore', {
  state: () =>
    ({
      accessToken: undefined,
      refreshToken: undefined,
      user: undefined,
      initialized: false,
    }) as TAuth,
  getters: {
    isAuthenticated: (state): boolean => Boolean(state.accessToken),
    displayName: (state): string => state.user?.display_name || state.user?.username || '',
  },
  actions: {
    setTokens(accessToken: string, refreshToken: string): void {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
    },
    clearSession(): void {
      this.accessToken = undefined;
      this.refreshToken = undefined;
      this.user = undefined;
    },
    /** Loads the account behind the access token into the store. */
    async fetchMe(): Promise<ApiUserDto | undefined> {
      const { data, error } = await getUsersMe();
      if (error || !data) {
        return undefined;
      }
      this.user = data;
      return data;
    },
    /**
     * Restores a persisted session once per page load. The access token may be
     * expired: the request interceptor rotates the pair and retries, so a
     * successful call is proof the session is still usable.
     */
    async restoreSession(): Promise<boolean> {
      if (this.initialized) {
        return this.isAuthenticated;
      }
      if (!this.accessToken) {
        this.initialized = true;
        return false;
      }

      const user = await this.fetchMe();
      this.initialized = true;
      if (!user) {
        this.clearSession();
        return false;
      }
      return true;
    },
    async login(credentials: ApiLoginRequest): Promise<AuthResult> {
      const { data, error } = await postAuthLogin({ body: credentials });
      if (error || !data?.access_token || !data.refresh_token) {
        return { ok: false, error };
      }

      this.setTokens(data.access_token, data.refresh_token);
      await this.fetchMe();
      return { ok: true };
    },
    async register(payload: ApiRegisterRequest): Promise<AuthResult> {
      const { data, error } = await postAuthRegister({ body: payload });
      if (error || !data) {
        return { ok: false, error };
      }
      return { ok: true };
    },
    async updateProfile(payload: ApiUpdateMeRequest): Promise<AuthResult> {
      const { data, error } = await patchUsersMe({ body: payload });
      if (error || !data) {
        return { ok: false, error };
      }
      this.user = data;
      return { ok: true };
    },
    async changePassword(payload: ApiChangePasswordRequest): Promise<AuthResult> {
      const { error } = await putUsersMePassword({ body: payload });
      return { ok: !error, error };
    },
    logout(): void {
      this.clearSession();
    },
  },
  persist: {
    key: 'authStore',
    pick: ['accessToken', 'refreshToken', 'user'],
  },
});
