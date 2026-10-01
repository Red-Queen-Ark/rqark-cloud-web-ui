import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

function manifestDevPlugin(appName: string, appDescription: string) {
  return {
    name: 'manifest-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/manifest.webmanifest', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          return next();
        }
        const manifest = {
          name: appName,
          short_name: appName,
          description: appDescription,
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#ffffff',
          lang: 'en',
          scope: '/',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        };
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(JSON.stringify(manifest));
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME ?? '';
  const appDescription = env.VITE_APP_DESCRIPTION ?? '';
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:7302';
  // The chat socket lives on the agent cloud, which is a second service on its
  // own port, so it is addressed separately from the data cloud API.
  const agentApiProxyTarget = env.VITE_AGENT_API_PROXY_TARGET || 'http://localhost:8000';

  // index.html carries `%VITE_APP_NAME%` and the PWA manifest takes the same
  // name. Vite substitutes the placeholder only when the variable is set and
  // otherwise leaves the literal text in the output, so a missing value used to
  // ship "%VITE_APP_NAME%" as the tab title. Fail the build instead.
  if (mode === 'production' && !appName) {
    throw new Error('VITE_APP_NAME is not set. Put it in .env for a local build, or pass it as a build arg (see docker/dockerfile).');
  }

  return {
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@root': resolve(__dirname, '.'),
      },
    },
    server: {
      // The backend sends no CORS headers, so the dev server proxies /api to it.
      proxy: {
        // The data cloud serves the REST API only.
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        // The chat session is a WebSocket on the agent cloud, a second service,
        // so it gets its own prefix rather than riding /api. The rewrite maps
        // the prefix onto the agent cloud's own /api prefix.
        '/agent-api': {
          target: agentApiProxyTarget,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/agent-api/, '/api'),
        },
      },
    },
    plugins: [
      tailwindcss(),
      vue(),
      manifestDevPlugin(appName, appDescription),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'favicon.ico', 'logo.png', 'apple-touch-icon-180x180.png', 'icons.svg'],
        manifest: {
          name: appName,
          short_name: appName,
          description: appDescription,
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        },
      }),
    ],
  };
});
