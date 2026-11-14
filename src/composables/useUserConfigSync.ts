import { useProjectStore } from '@/stores/projectStore';
import { useUserConfigStore } from '@/stores/userConfigStore';
import { useThemeStore } from '@/stores/themeStore';
import { onScopeDispose, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

export const PROJECT_ORDER_POLL_MS = 15_000;

export function useUserConfigSync(): void {
  const configStore = useUserConfigStore();
  const themeStore = useThemeStore();
  const projectStore = useProjectStore();
  const { locale } = useI18n();
  const route = useRoute();
  const router = useRouter();

  const applyProjectOrder = (order: readonly string[] | undefined) => {
    projectStore.applyOrder(order ?? []);
  };

  void configStore.load().then(() => {
    if (!configStore.loaded) {
      return;
    }

    if (configStore.theme) {
      themeStore.setFamily(configStore.theme.family);
      themeStore.setMode(configStore.theme.mode);
    } else {
      void configStore.saveTheme({ family: themeStore.family, mode: themeStore.mode });
    }

    if (configStore.language && configStore.language !== locale.value) {
      void router.replace({ name: route.name, params: { ...route.params, lang: configStore.language }, query: route.query });
    } else if (!configStore.language) {
      void configStore.saveLanguage(locale.value);
    }

    applyProjectOrder(configStore.projectOrder);
  });

  watch(
    () => [themeStore.family, themeStore.mode] as const,
    ([family, mode]) => {
      if (!configStore.loaded) {
        return;
      }
      const stored = configStore.theme;
      if (stored && stored.family === family && stored.mode === mode) {
        return;
      }
      void configStore.saveTheme({ family, mode });
    },
  );

  watch(locale, (value) => {
    if (!configStore.loaded || configStore.language === value) {
      return;
    }
    void configStore.saveLanguage(value);
  });

  watch(
    () => configStore.projectOrder,
    (order) => applyProjectOrder(order),
    { deep: true },
  );

  const refresh = () => {
    void configStore.refreshProjectOrder();
  };

  const timer = window.setInterval(refresh, PROJECT_ORDER_POLL_MS);

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      refresh();
    }
  };
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', onVisibility);

  onScopeDispose(() => {
    window.clearInterval(timer);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', onVisibility);
  });
}
