import { createApp } from 'vue';
import './pwa';
import './style.css';
import App from './App.vue';
import { i18n } from './i18n';
import router from './routes/routes';
import pinia from './stores';
import { useThemeStore } from './stores/themeStore';
import { setupApiClient } from './api-client/runtime';

const app = createApp(App);
app.use(i18n);
app.use(pinia);
app.use(router);

setupApiClient({
  onSessionExpired: () => {
    const lang = (router.currentRoute.value.params.lang as string) || 'en';
    void router.replace({ name: 'login', params: { lang } });
  },
});

app.mount('#app');

useThemeStore().init();
