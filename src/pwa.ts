import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

registerSW({
  immediate: true,
  onRegisteredSW(_swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) {
    if (!registration) {
      return;
    }
    setInterval(() => {
      registration.update().catch(() => undefined);
    }, UPDATE_CHECK_INTERVAL);
  },
});
