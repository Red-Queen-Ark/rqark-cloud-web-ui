import { useUserConfigStore } from '@/stores/userConfigStore';
import { useThemeStore } from '@/stores/themeStore';
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

export function useUserConfigSync(): void {
  const configStore = useUserConfigStore();
  const themeStore = useThemeStore();
  const { locale } = useI18n();
  const route = useRoute();
  const router = useRouter();

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
}
