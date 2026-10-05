import { useAuthStore } from '@/stores/authStore';
import type { ResolvedRequestOptions } from '@/api/client';
import { client } from '@/api/client.gen';
import { getValidRequestBody } from '@/api/core/utils.gen';
import { postAuthRefresh } from '@/api/sdk.gen';

/**
 * Paths that must never trigger the "refresh and retry" flow. A rejected login
 * is a wrong password, not an expired session, and a rejected refresh must not
 * recurse into itself.
 */
const RETRY_EXEMPT_PATHS = ['/auth/'];

/** Set up options for the generated client. */
export interface ApiRuntimeOptions {
  /** Called when the session cannot be recovered and the tokens were cleared. */
  onSessionExpired?: () => void;
}

let refreshInFlight: Promise<boolean> | null = null;

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

function isRetryExempt(url: string): boolean {
  return RETRY_EXEMPT_PATHS.some((path) => url.includes(path));
}

async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const auth = useAuthStore();
  const refreshToken = auth.refreshToken;
  if (!refreshToken) {
    return false;
  }

  // Single flight: a burst of 401 responses must rotate the refresh token once,
  // because the backend invalidates the token it just consumed.
  refreshInFlight = postAuthRefresh({ body: { refresh_token: refreshToken } })
    .then(({ data }) => {
      if (data?.access_token && data?.refresh_token) {
        auth.setTokens(data.access_token, data.refresh_token);
        return true;
      }
      return false;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export function refreshSession(): Promise<boolean> {
  return refreshTokens();
}

async function retryWithToken(request: Request, options: ResolvedRequestOptions, token: string): Promise<Response> {
  const fetchImpl = (client.getConfig().fetch ?? globalThis.fetch) as typeof fetch;
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const body = getValidRequestBody(options);
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'follow',
  };
  if (body !== undefined && body !== null) {
    init.body = body as BodyInit;
  }

  return fetchImpl(new Request(request.url, init));
}

/**
 * Points the generated client at the backend and installs the two behaviours
 * the generated code cannot express: attaching the access token to every
 * request, and rotating an expired token pair once before giving up.
 */
export function setupApiClient({ onSessionExpired }: ApiRuntimeOptions = {}): void {
  client.setConfig({ baseUrl: apiBaseUrl() });

  client.interceptors.request.use((request) => {
    const auth = useAuthStore();
    if (!auth.accessToken || request.headers.has('Authorization')) {
      return request;
    }

    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${auth.accessToken}`);
    return new Request(request, { headers });
  });

  client.interceptors.response.use(async (response, request, options) => {
    if (response.status !== 401 || isRetryExempt(request.url)) {
      return response;
    }

    const auth = useAuthStore();
    if (!auth.refreshToken) {
      auth.clearSession();
      onSessionExpired?.();
      return response;
    }

    const refreshed = await refreshTokens();
    if (!refreshed) {
      auth.clearSession();
      onSessionExpired?.();
      return response;
    }

    return retryWithToken(request, options, auth.accessToken as string);
  });
}
