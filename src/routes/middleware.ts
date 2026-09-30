import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { i18n } from '@/i18n';
import type { Router } from 'vue-router';
import { type RouteLocationNormalizedGeneric } from 'vue-router';
import { isLoggedIn } from '../middleware/auth';

export function setMiddleware(router: Router) {
  router.beforeEach(async (to: RouteLocationNormalizedGeneric) => {
    // language
    if (to.path === '/') {
      return { path: '/en' };
    }

    const lang = (to.params.lang as string) || 'en';

    // login
    const isLogin: boolean = await isLoggedIn();
    const isPublic = to.meta.public === true;
    if (!isPublic && !isLogin) {
      return { name: 'login', params: { lang } };
    } else if (isPublic && isLogin && to.name === 'login') {
      return { name: 'home', params: { lang } };
    }

    // admin pages: the backend rejects a plain token with 403, so the route is
    // closed here instead of rendering a page that cannot load anything.
    if (to.meta.superuserOnly === true && useAuthStore().user?.is_superuser !== true) {
      useAlertStore().addItem({ level: 'error', message: i18n.global.t('error.FORBIDDEN') });
      return { name: 'home', params: { lang } };
    }

    // default
    return true;
  });
}
