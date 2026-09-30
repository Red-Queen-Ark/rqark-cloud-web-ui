import { useLanguageStore } from '@/stores/languageStore';
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const LANG_MAP: Record<string, string> = {
  'zh-cn': 'zh-cn',
  'zh-tw': 'zh-tw',
  en: 'en',
};

export function useLanguage() {
  const route = useRoute();
  const { locale } = useI18n();
  const languageStore = useLanguageStore();

  function syncLocale(lang: string) {
    locale.value = lang;
    languageStore.lang = lang;
    languageStore.user = true;
    document.documentElement.lang = lang.toLowerCase();
  }

  // Initial sync from route
  const routeLang = route.params.lang as string;
  const matchedLang = Object.keys(LANG_MAP).find((key) => routeLang?.startsWith(key)) || 'en';
  syncLocale(LANG_MAP[matchedLang]);

  // React to route param changes (e.g. Topbar language switch)
  watch(
    () => route.params.lang,
    (newLang) => {
      const lang = newLang as string;
      const matched = Object.keys(LANG_MAP).find((key) => lang?.startsWith(key)) || 'en';
      syncLocale(LANG_MAP[matched]);
    },
  );
}
