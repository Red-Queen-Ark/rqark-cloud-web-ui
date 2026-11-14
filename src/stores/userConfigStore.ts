import { getUserConfig, putUserConfigByKey } from '@/api';
import { LANGUAGES } from '@/config/languages';
import { PROJECT_ORDER_CONFIG_KEY, parseProjectOrder, toProjectOrderValue } from '@/config/projectOrder';
import { THEME_FAMILIES, THEME_MODES, type ThemeFamily, type ThemeMode } from '@/stores/themeStore';
import { defineStore } from 'pinia';

export const THEME_CONFIG_KEY = 'theme';
export const LANGUAGE_CONFIG_KEY = 'language';

export interface ThemePreference {
  family: ThemeFamily;
  mode: ThemeMode;
}

type ConfigValue = Record<string, unknown>;

function toConfigValue(value: unknown): ConfigValue {
  return value as ConfigValue;
}

function isThemeFamily(value: unknown): value is ThemeFamily {
  return typeof value === 'string' && THEME_FAMILIES.some((family) => family.value === value);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value as ThemeMode);
}

export function parseThemePreference(value: unknown): ThemePreference | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { family, mode } = value as Record<string, unknown>;
  if (!isThemeFamily(family) || !isThemeMode(mode)) {
    return undefined;
  }
  return { family, mode };
}

export function parseLanguagePreference(value: unknown): string | undefined {
  if (typeof value !== 'string' || !LANGUAGES.some((option) => option.value === value)) {
    return undefined;
  }
  return value;
}

export const useUserConfigStore = defineStore('userConfigStore', {
  state: () => ({
    theme: undefined as ThemePreference | undefined,
    language: undefined as string | undefined,
    projectOrder: undefined as string[] | undefined,
    projectOrderSaving: false,
    loaded: false,
  }),

  actions: {
    async load(): Promise<void> {
      const { data, error } = await getUserConfig();
      if (error || !data) {
        return;
      }

      this.theme = parseThemePreference(data.find((entry) => entry.key === THEME_CONFIG_KEY)?.value);
      this.language = parseLanguagePreference(data.find((entry) => entry.key === LANGUAGE_CONFIG_KEY)?.value);
      if (!this.projectOrderSaving) {
        this.projectOrder = parseProjectOrder(data.find((entry) => entry.key === PROJECT_ORDER_CONFIG_KEY)?.value);
      }
      this.loaded = true;
    },

    async refreshProjectOrder(): Promise<void> {
      if (this.projectOrderSaving) {
        return;
      }
      const { data, error } = await getUserConfig();
      if (error || !data || this.projectOrderSaving) {
        return;
      }
      this.projectOrder = parseProjectOrder(data.find((entry) => entry.key === PROJECT_ORDER_CONFIG_KEY)?.value);
    },

    async saveTheme(preference: ThemePreference): Promise<void> {
      this.theme = preference;
      await putUserConfigByKey({ path: { key: THEME_CONFIG_KEY }, body: { value: toConfigValue(preference) } });
    },

    async saveLanguage(language: string): Promise<void> {
      this.language = language;
      await putUserConfigByKey({ path: { key: LANGUAGE_CONFIG_KEY }, body: { value: toConfigValue(language) } });
    },

    async saveProjectOrder(order: readonly string[]): Promise<boolean> {
      const previous = this.projectOrder;
      this.projectOrder = [...order];
      this.projectOrderSaving = true;
      try {
        const { error } = await putUserConfigByKey({ path: { key: PROJECT_ORDER_CONFIG_KEY }, body: { value: toProjectOrderValue(order) } });
        if (error) {
          this.projectOrder = previous;
          return false;
        }
        return true;
      } catch {
        this.projectOrder = previous;
        return false;
      } finally {
        this.projectOrderSaving = false;
      }
    },
  },
});
