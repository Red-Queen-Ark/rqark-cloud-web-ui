/**
 * Where the app talks to the backends, and how it reaches them.
 *
 * The web build is served by the same origin that proxies `/api` and
 * `/agent-api`, so both bases stay relative and the proxy does the work.
 *
 * The desktop build is a webview with no proxy in front of it. Its HTTP calls
 * go through the Rust client of the http plugin, which is not bound to the
 * origin of the page and is therefore not subject to CORS. The bases are
 * absolute URLs, and they are read from the store, because a desktop install
 * talks to whatever machine the user runs the backends on.
 */

const API_BASE_KEY = 'apiBaseUrl';
const AGENT_API_BASE_KEY = 'agentApiBaseUrl';
const STORE_FILE = 'server.json';

export const DEFAULT_DESKTOP_API_BASE_URL = 'http://localhost:7302/api';
export const DEFAULT_DESKTOP_AGENT_API_BASE_URL = 'http://localhost:8000/api';

export interface ServerConfig {
  apiBaseUrl: string;
  agentApiBaseUrl: string;
}

/** Whether the code is running inside the Tauri webview. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isAbsolute(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

let config: ServerConfig = {
  apiBaseUrl: stripTrailingSlash(import.meta.env.VITE_API_BASE_URL || '/api'),
  agentApiBaseUrl: stripTrailingSlash(import.meta.env.VITE_AGENT_API_BASE_URL || '/agent-api'),
};

interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

let store: Store | null = null;

/**
 * The desktop store, loaded once.
 *
 * A second load would hand out a second instance over the same file, so the
 * instance is kept and reused.
 */
async function loadStore(): Promise<Store | null> {
  if (!isDesktop()) {
    return null;
  }
  if (store) {
    return store;
  }
  try {
    const { load } = await import('@tauri-apps/plugin-store');
    store = await load(STORE_FILE, { autoSave: true });
    return store;
  } catch {
    return null;
  }
}

/**
 * Reads the backends the desktop app should talk to.
 *
 * The web build has no store to read and keeps the relative bases it was
 * built with, so this only does anything on the desktop.
 */
export async function initRuntimeConfig(): Promise<void> {
  if (!isDesktop()) {
    return;
  }
  const loaded = await loadStore();
  if (!loaded) {
    config = { apiBaseUrl: DEFAULT_DESKTOP_API_BASE_URL, agentApiBaseUrl: DEFAULT_DESKTOP_AGENT_API_BASE_URL };
    return;
  }
  const storedApi = await loaded.get<string>(API_BASE_KEY);
  const storedAgent = await loaded.get<string>(AGENT_API_BASE_KEY);
  config = {
    apiBaseUrl: stripTrailingSlash(storedApi && storedApi.length > 0 ? storedApi : DEFAULT_DESKTOP_API_BASE_URL),
    agentApiBaseUrl: stripTrailingSlash(storedAgent && storedAgent.length > 0 ? storedAgent : DEFAULT_DESKTOP_AGENT_API_BASE_URL),
  };
}

/** Stores the backends the desktop app should talk to. */
export async function saveServerConfig(next: ServerConfig): Promise<void> {
  config = {
    apiBaseUrl: stripTrailingSlash(next.apiBaseUrl),
    agentApiBaseUrl: stripTrailingSlash(next.agentApiBaseUrl),
  };
  const loaded = await loadStore();
  if (!loaded) {
    return;
  }
  await loaded.set(API_BASE_KEY, config.apiBaseUrl);
  await loaded.set(AGENT_API_BASE_KEY, config.agentApiBaseUrl);
  await loaded.save();
}

/** Base URL the generated API client prefixes to every path. */
export function apiBaseUrl(): string {
  return config.apiBaseUrl;
}

/** Base URL the chat socket and the other agent cloud routes are addressed under. */
export function agentApiBaseUrl(): string {
  return config.agentApiBaseUrl;
}

export function serverConfig(): ServerConfig {
  return { ...config };
}

/** An absolute URL on the agent cloud, ready for a WebSocket handshake. */
export function agentWsUrl(path: string): string {
  const base = agentApiBaseUrl();
  const url = isAbsolute(base) ? new URL(`${base}${path}`) : new URL(`${base}${path}`, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * The fetch the app uses for its HTTP calls.
 *
 * On the desktop the request is made by the Rust client, so it carries no
 * webview origin and the backend needs no CORS rule for the app. On the web
 * the browser fetch is used, unchanged.
 */
export async function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (isDesktop()) {
    const { fetch: rustFetch } = await import('@tauri-apps/plugin-http');
    return rustFetch(input, init);
  }
  return fetch(input as RequestInfo, init);
}

/**
 * The URL of the PCM worklet.
 *
 * The webview cannot load a module from the app's own custom protocol, so the
 * desktop build asks the Rust side for the source and hands it over as a blob
 * URL. The web build serves the file from the app root.
 */
export async function voiceWorkletUrl(path: string): Promise<string> {
  if (!isDesktop()) {
    return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).toString();
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const source = await invoke<string>('voice_worklet_script');
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}
