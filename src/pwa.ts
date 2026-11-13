import { registerSW } from 'virtual:pwa-register';
import { isDesktop } from '@/config/runtime';

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

// The desktop app is served from the app's own custom protocol, where a
// service worker cannot be registered.
if (!isDesktop()) {
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
}
