/**
 * Where the app talks to the backends, and how it reaches them.
 *
 * Both builds address the backends through the origin that serves the app: the
 * web build is proxied by the server that serves it, the desktop build by the
 * Go side of the app. The bases therefore stay relative, and the backends need
 * no CORS rule for either of them.
 *
 * A desktop install talks to whatever machine the user runs the backends on, so
 * the addresses behind those two paths are read from the desktop settings.
 */

export interface ServerConfig {
  apiBaseUrl: string;
  agentApiBaseUrl: string;
}

/** Path the generated API client prefixes to every call. */
const API_BASE_PATH = stripTrailingSlash(import.meta.env.VITE_API_BASE_URL || '/api');

/** Path the chat socket and the other agent cloud routes are addressed under. */
const AGENT_API_BASE_PATH = stripTrailingSlash(import.meta.env.VITE_AGENT_API_BASE_URL || '/agent-api');

/**
 * Where a fresh install looks for the backends. The Go side owns the same pair,
 * and answers with them when the settings file is missing.
 */
const LOCAL_API_BASE_URL = 'http://localhost:7302/api';
const LOCAL_AGENT_API_BASE_URL = 'http://localhost:8000/api';

/** The addresses the desktop settings hold. Unused by the web build. */
let servers: ServerConfig = {
  apiBaseUrl: LOCAL_API_BASE_URL,
  agentApiBaseUrl: LOCAL_AGENT_API_BASE_URL,
};

/** Set by the Vite build the Wails task drives. */
declare const __DESKTOP_BUILD__: boolean;

/**
 * Whether the code is running inside the Wails webview.
 *
 * The `_wails` global only exists once the Wails runtime module has been
 * imported, and the app imports it while loading the desktop settings, so the
 * build flag has to answer for the first call. The global still covers the
 * builds the flag does not reach.
 */
export function isDesktop(): boolean {
  if (typeof __DESKTOP_BUILD__ !== 'undefined' && __DESKTOP_BUILD__) {
    return true;
  }
  return typeof window !== 'undefined' && '_wails' in window;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isAbsolute(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Reads the backends the desktop app should talk to.
 *
 * The web build has nothing to read: its proxy is fixed by the server that
 * serves it. The desktop build asks the Go side, which owns the settings file.
 */
export async function initRuntimeConfig(): Promise<void> {
  if (!isDesktop()) {
    return;
  }
  const { loadServerConfig } = await import('@/config/desktopSettings');
  const stored = await loadServerConfig();
  servers = {
    apiBaseUrl: stripTrailingSlash(stored.apiBaseUrl) || LOCAL_API_BASE_URL,
    agentApiBaseUrl: stripTrailingSlash(stored.agentApiBaseUrl) || LOCAL_AGENT_API_BASE_URL,
  };
}

/** Stores the backends the desktop app should talk to. */
export async function saveServerConfig(next: ServerConfig): Promise<void> {
  servers = {
    apiBaseUrl: stripTrailingSlash(next.apiBaseUrl),
    agentApiBaseUrl: stripTrailingSlash(next.agentApiBaseUrl),
  };
  if (!isDesktop()) {
    return;
  }
  const { saveServerConfig: persist } = await import('@/config/desktopSettings');
  await persist(servers);
}

/** Base URL the generated API client prefixes to every path. */
export function apiBaseUrl(): string {
  return API_BASE_PATH;
}

/** Base URL the chat socket and the other agent cloud routes are addressed under. */
export function agentApiBaseUrl(): string {
  return AGENT_API_BASE_PATH;
}

export function serverConfig(): ServerConfig {
  return { ...servers };
}

/** An absolute URL on the agent cloud, ready for a WebSocket handshake. */
export function agentWsUrl(path: string): string {
  // The desktop app has no proxy in front of its websockets, so it addresses
  // the agent cloud host itself. The web build keeps the relative path and
  // lets its server proxy the upgrade.
  const base = isDesktop() && servers.agentApiBaseUrl ? servers.agentApiBaseUrl : AGENT_API_BASE_PATH;
  const url = isAbsolute(base) ? new URL(`${base}${path}`) : new URL(`${base}${path}`, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * The fetch the app uses for its HTTP calls.
 *
 * Both builds call their own origin, so the browser fetch is the whole story.
 */
export async function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return fetch(input as RequestInfo, init);
}

/**
 * The URL of the PCM worklet.
 *
 * The web build loads the module straight from the app root. The desktop
 * webview cannot import a module over its asset protocol, so it fetches the
 * source and hands it over as a blob URL.
 */
export async function voiceWorkletUrl(path: string): Promise<string> {
  const url = new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).toString();
  if (!isDesktop()) {
    return url;
  }
  const response = await fetch(url);
  const source = await response.text();
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}
