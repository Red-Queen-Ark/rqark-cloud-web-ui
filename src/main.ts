import { createApp } from 'vue';
import './pwa';
import './style.css';
import App from './App.vue';
import { i18n } from './i18n';
import router from './routes/routes';
import pinia from './stores';
import { useThemeStore } from './stores/themeStore';
import { useAuthStore } from './stores/authStore';
import { setupApiClient } from '@/api-client/runtime';
import { initRuntimeConfig } from '@/config/runtime';
import { onAuthSessionChange } from '@/utils/authSession';
import { applyIOSStandaloneClass } from '@/utils/iosStandalone';
import { dismissBootSplash } from '@/utils/bootSplash';

const app = createApp(App);
app.use(i18n);
app.use(pinia);
app.use(router);

// The desktop app reads the backends it should talk to from its store, so the
// API client must not be pointed at a base URL before that has happened. The
// web build has nothing to read and is ready at once.
initRuntimeConfig().then(() => {
  setupApiClient({
    onSessionExpired: () => {
      const lang = (router.currentRoute.value.params.lang as string) || 'en';
      void router.replace({ name: 'login', params: { lang } });
    },
  });

  app.mount('#app');

  // The splash from index.html stays until the first screen has been routed to,
  // so it covers the boot instead of flashing an empty shell. It never waits
  // more than a few seconds: a session that cannot be restored offline must
  // still end up on the login page rather than on a permanent splash.
  const bootedAt = performance.now();
  void Promise.race([router.isReady(), new Promise((resolve) => setTimeout(resolve, 4000))]).then(() => {
    requestAnimationFrame(() => dismissBootSplash({ shownAt: bootedAt }));
  });
});

// Another tab rotated the pair or logged out: follow it, otherwise this tab
// keeps presenting a refresh token the backend has already burned.
onAuthSessionChange((event) => {
  const auth = useAuthStore();
  if (event.type === 'tokens') {
    auth.adoptTokens(event.pair);
    return;
  }
  auth.clearSession();
  const lang = (router.currentRoute.value.params.lang as string) || 'en';
  void router.replace({ name: 'login', params: { lang } });
});

applyIOSStandaloneClass();

useThemeStore().init();
