/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_DESCRIPTION: string;
  /** Base URL the generated API client prefixes to every path. Defaults to /api. */
  readonly VITE_API_BASE_URL?: string;
  /** Dev server proxy target for /api. */
  readonly VITE_API_PROXY_TARGET?: string;
  /** Swagger document consumed by `bun run api-client`. */
  readonly VITE_API_SPEC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:pwa-register' {
  import type { RegisterSWOptions } from 'vite-plugin-pwa';

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => void;
}
