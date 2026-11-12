import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  saved: 0,
  get: vi.fn(),
  set: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async () => ({
    get: async (key: string) => store.values.get(key),
    set: async (key: string, value: unknown) => {
      store.values.set(key, value);
    },
    save: async () => {
      store.saved += 1;
    },
  })),
}));

import { agentApiBaseUrl, agentWsUrl, apiBaseUrl, apiFetch, initRuntimeConfig, isDesktop, saveServerConfig, serverConfig } from './runtime';

const rustFetch = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: rustFetch }));

function desktop(): void {
  (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
}

function browser(): void {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

beforeEach(() => {
  store.values.clear();
  store.saved = 0;
  browser();
});

describe('runtime config', () => {
  it('knows it is not the desktop app in a browser', () => {
    expect(isDesktop()).toBe(false);
  });

  it('knows it is the desktop app inside the webview', () => {
    desktop();
    expect(isDesktop()).toBe(true);
  });

  it('keeps the relative bases of the web build', async () => {
    await initRuntimeConfig();
    expect(apiBaseUrl()).toBe('/api');
    expect(agentApiBaseUrl()).toBe('/agent-api');
  });

  it('falls back to the local backends when the desktop store is empty', async () => {
    desktop();
    await initRuntimeConfig();
    expect(apiBaseUrl()).toBe('http://localhost:7302/api');
    expect(agentApiBaseUrl()).toBe('http://localhost:8000/api');
  });

  it('reads the backends the desktop app was pointed at', async () => {
    desktop();
    store.values.set('apiBaseUrl', 'http://10.0.0.5:7302/api');
    store.values.set('agentApiBaseUrl', 'http://10.0.0.5:8000/api');
    await initRuntimeConfig();
    expect(apiBaseUrl()).toBe('http://10.0.0.5:7302/api');
    expect(agentApiBaseUrl()).toBe('http://10.0.0.5:8000/api');
  });

  it('applies a saved address at once and keeps it', async () => {
    desktop();
    await initRuntimeConfig();
    await saveServerConfig({ apiBaseUrl: 'http://10.0.0.6:7302/api/', agentApiBaseUrl: 'http://10.0.0.6:8000/api/' });

    expect(apiBaseUrl()).toBe('http://10.0.0.6:7302/api');
    expect(agentApiBaseUrl()).toBe('http://10.0.0.6:8000/api');
    expect(serverConfig().apiBaseUrl).toBe('http://10.0.0.6:7302/api');
    expect(store.values.get('apiBaseUrl')).toBe('http://10.0.0.6:7302/api');
    expect(store.saved).toBe(1);
  });

  it('turns the agent cloud base into a websocket address', async () => {
    desktop();
    await initRuntimeConfig();
    await saveServerConfig({ apiBaseUrl: 'http://10.0.0.6:7302/api', agentApiBaseUrl: 'http://10.0.0.6:8000/api' });

    expect(agentWsUrl('/chat/ws/1')).toBe('ws://10.0.0.6:8000/api/chat/ws/1');
  });

  it('keeps a secure agent cloud on a secure websocket', async () => {
    desktop();
    await initRuntimeConfig();
    await saveServerConfig({ apiBaseUrl: 'https://10.0.0.6/api', agentApiBaseUrl: 'https://10.0.0.6/api' });

    expect(agentWsUrl('/voice/ws')).toBe('wss://10.0.0.6/api/voice/ws');
  });
});

describe('apiFetch', () => {
  it('uses the browser fetch on the web', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/ping');

    expect(fetchMock).toHaveBeenCalledWith('/api/ping', undefined);
    vi.unstubAllGlobals();
  });

  it('uses the Rust client on the desktop', async () => {
    desktop();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    rustFetch.mockResolvedValue({ ok: true });

    await apiFetch('http://10.0.0.6:7302/api/ping');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(rustFetch).toHaveBeenCalledWith('http://10.0.0.6:7302/api/ping', undefined);
    vi.unstubAllGlobals();
  });
});
