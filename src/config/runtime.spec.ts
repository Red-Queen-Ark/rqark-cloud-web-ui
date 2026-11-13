import { beforeEach, describe, expect, it, vi } from 'vitest';

const bridge = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@/config/desktopSettings', () => ({
  loadServerConfig: bridge.load,
  saveServerConfig: bridge.save,
}));

import { agentApiBaseUrl, agentWsUrl, apiBaseUrl, apiFetch, initRuntimeConfig, isDesktop, saveServerConfig, serverConfig, voiceWorkletUrl } from './runtime';

function desktop(): void {
  (window as unknown as { _wails?: unknown })._wails = {};
}

function browser(): void {
  delete (window as unknown as { _wails?: unknown })._wails;
}

beforeEach(() => {
  vi.clearAllMocks();
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

  it('addresses both builds through their own origin', async () => {
    await initRuntimeConfig();
    expect(apiBaseUrl()).toBe('/api');
    expect(agentApiBaseUrl()).toBe('/agent-api');

    desktop();
    bridge.load.mockResolvedValue({ apiBaseUrl: 'http://10.0.0.5:7302/api', agentApiBaseUrl: 'http://10.0.0.5:8000/api' });
    await initRuntimeConfig();
    expect(apiBaseUrl()).toBe('/api');
    expect(agentApiBaseUrl()).toBe('/agent-api');
  });

  it('reads the addresses the desktop app was pointed at', async () => {
    desktop();
    bridge.load.mockResolvedValue({ apiBaseUrl: 'http://10.0.0.5:7302/api', agentApiBaseUrl: 'http://10.0.0.5:8000/api' });
    await initRuntimeConfig();

    expect(serverConfig()).toEqual({ apiBaseUrl: 'http://10.0.0.5:7302/api', agentApiBaseUrl: 'http://10.0.0.5:8000/api' });
  });

  it('falls back to the local backends when the settings file is empty', async () => {
    desktop();
    bridge.load.mockResolvedValue({ apiBaseUrl: '', agentApiBaseUrl: '' });
    await initRuntimeConfig();

    expect(serverConfig()).toEqual({ apiBaseUrl: 'http://localhost:7302/api', agentApiBaseUrl: 'http://localhost:8000/api' });
  });

  it('hands a saved address to the Go side and keeps it', async () => {
    desktop();
    bridge.load.mockResolvedValue({ apiBaseUrl: 'http://10.0.0.5:7302/api', agentApiBaseUrl: 'http://10.0.0.5:8000/api' });
    await initRuntimeConfig();
    await saveServerConfig({ apiBaseUrl: 'http://10.0.0.6:7302/api/', agentApiBaseUrl: 'http://10.0.0.6:8000/api/' });

    expect(serverConfig()).toEqual({ apiBaseUrl: 'http://10.0.0.6:7302/api', agentApiBaseUrl: 'http://10.0.0.6:8000/api' });
    expect(bridge.save).toHaveBeenCalledWith({ apiBaseUrl: 'http://10.0.0.6:7302/api', agentApiBaseUrl: 'http://10.0.0.6:8000/api' });
  });

  it('does not reach across the bridge on the web', async () => {
    await saveServerConfig({ apiBaseUrl: 'http://10.0.0.6:7302/api', agentApiBaseUrl: 'http://10.0.0.6:8000/api' });

    expect(bridge.save).not.toHaveBeenCalled();
  });

  it('turns the agent cloud address into a websocket address', async () => {
    desktop();
    bridge.load.mockResolvedValue({ apiBaseUrl: 'http://10.0.0.6:7302/api', agentApiBaseUrl: 'http://10.0.0.6:8000/api' });
    await initRuntimeConfig();

    expect(agentWsUrl('/chat/ws/1')).toBe('ws://10.0.0.6:8000/api/chat/ws/1');
  });

  it('keeps a secure agent cloud on a secure websocket', async () => {
    desktop();
    bridge.load.mockResolvedValue({ apiBaseUrl: 'https://10.0.0.6/api', agentApiBaseUrl: 'https://10.0.0.6/api' });
    await initRuntimeConfig();

    expect(agentWsUrl('/voice/ws')).toBe('wss://10.0.0.6/api/voice/ws');
  });
});

describe('apiFetch', () => {
  it('calls its own origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/ping');

    expect(fetchMock).toHaveBeenCalledWith('/api/ping', undefined);
    vi.unstubAllGlobals();
  });
});

describe('voiceWorkletUrl', () => {
  it('loads the worklet from the app root on the web', async () => {
    await expect(voiceWorkletUrl('voice-pcm.worklet.js')).resolves.toContain('/voice-pcm.worklet.js');
  });

  it('hands the worklet over as a blob on the desktop', async () => {
    desktop();
    const source = 'registerProcessor("pcm", class extends AudioWorkletProcessor {});';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => source }));
    const createObjectURL = vi.fn().mockReturnValue('blob:worklet');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL }));

    await expect(voiceWorkletUrl('voice-pcm.worklet.js')).resolves.toBe('blob:worklet');
    expect(createObjectURL).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});
