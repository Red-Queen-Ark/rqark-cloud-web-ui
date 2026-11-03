import { useAuthStore } from '@/stores/authStore';
import type { ResolvedRequestOptions } from '@/api/client';
import { client } from '@/api/client.gen';
import { getValidRequestBody } from '@/api/core/utils.gen';
import { postAuthRefresh } from '@/api/sdk.gen';
import { readTokenPair, withAuthTokenLock } from '@/utils/authSession';

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

/**
 * - `refreshed`: a usable pair is in the store, retry the request.
 * - `invalid`: the backend rejected the refresh token, the session is dead.
 * - `unavailable`: transport or 5xx failure, the session may well still be
 *   valid, so it must not be thrown away.
 */
export type RefreshOutcome = 'refreshed' | 'invalid' | 'unavailable';

let refreshInFlight: Promise<RefreshOutcome> | null = null;

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

function isRetryExempt(url: string): boolean {
  return RETRY_EXEMPT_PATHS.some((path) => url.includes(path));
}

/**
 * Runs inside the cross-tab lock: either adopt the pair another tab already
 * rotated, or spend ours and store the replacement before letting go.
 */
async function rotateOrAdopt(): Promise<RefreshOutcome> {
  const auth = useAuthStore();
  const stored = readTokenPair();

  // Another tab got the lock first and already rotated. Its pair is in shared
  // storage, so adopting it costs nothing and keeps the spent token untouched.
  if (stored && stored.refreshToken !== auth.refreshToken) {
    auth.adoptTokens(stored);
    return 'refreshed';
  }

  const refreshToken = auth.refreshToken ?? stored?.refreshToken;
  if (!refreshToken) {
    return 'invalid';
  }

  try {
    const { data, error, response } = await postAuthRefresh({ body: { refresh_token: refreshToken } });
    if (data?.access_token && data.refresh_token) {
      auth.setTokens(data.access_token, data.refresh_token);
      return 'refreshed';
    }
    if (error) {
      const status = response?.status ?? 0;
      // 4xx means the token really is dead; anything else (5xx, gateway page)
      // is an outage and must not end the session.
      return status >= 400 && status < 500 ? 'invalid' : 'unavailable';
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * Rotates the token pair once per tab, and once across all tabs.
 *
 * The backend burns the refresh token it just consumed, so a second tab racing
 * with the same token is answered with 401. Serialising the rotation behind a
 * cross-tab lock (with the re-read above) is what stops that race from turning
 * into a silent logout.
 */
function refreshTokens(): Promise<RefreshOutcome> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = withAuthTokenLock(rotateOrAdopt).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Resolves true when a usable token pair is in the store afterwards. */
export async function refreshSession(): Promise<boolean> {
  return (await refreshTokens()) === 'refreshed';
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

    const outcome = await refreshTokens();
    if (outcome === 'invalid') {
      auth.clearSession();
      onSessionExpired?.();
      return response;
    }
    if (outcome !== 'refreshed') {
      // Backend unreachable: keep the session and let the caller report the
      // failed request.
      return response;
    }

    return retryWithToken(request, options, auth.accessToken as string);
  });
}
