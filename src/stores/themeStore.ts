import { defineStore } from 'pinia';

export type ThemeFamily = 'base' | 'gqs' | 'redqueen' | 'eva';
/** `system` is not a theme of its own: it defers to the OS `prefers-color-scheme`. */
export type ThemeMode = 'light' | 'dark' | 'system';
/** The two variants every family ships, i.e. what `system` resolves to. */
export type ThemeVariant = 'light' | 'dark';

export const THEME_FAMILIES: { value: ThemeFamily; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'gqs', label: 'GQS Navy' },
  { value: 'redqueen', label: 'Red Queen' },
  { value: 'eva', label: 'EVA' },
];

/** The selectable modes, in the order they are offered. */
export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** True when the OS asks for a dark appearance. */
function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export const useThemeStore = defineStore('themeStore', {
  state: () => ({
    family: 'base' as ThemeFamily,
    mode: 'system' as ThemeMode,
    /**
     * The OS preference, mirrored into state so `system` mode is reactive. It is
     * never persisted: on every load it is read back from the media query.
     */
    systemDark: false,
  }),

  getters: {
    resolvedMode(state): ThemeVariant {
      if (state.mode === 'system') {
        return state.systemDark ? 'dark' : 'light';
      }
      return state.mode;
    },

    theme(): `${ThemeFamily}-${ThemeVariant}` {
      return `${this.family}-${this.resolvedMode}`;
    },
  },

  actions: {
    apply() {
      document.documentElement.setAttribute('data-theme', this.theme);
      // Same value the pre-paint script writes into `<head>`, kept in step here
      // so scrollbars and form controls follow a later in-app switch too.
      document.documentElement.style.colorScheme = this.resolvedMode;
    },

    setFamily(family: ThemeFamily) {
      this.family = family;
      this.apply();
    },

    setMode(mode: ThemeMode) {
      this.mode = mode;
      this.systemDark = prefersDark();
      this.apply();
    },

    /**
     * Paints the stored preference and, from then on, repaints whenever the OS
     * flips while `system` mode is selected. Called once, from `main.ts`.
     */
    init() {
      this.systemDark = prefersDark();
      this.apply();

      window.matchMedia(DARK_QUERY).addEventListener('change', (event) => {
        this.systemDark = event.matches;
        if (this.mode === 'system') {
          this.apply();
        }
      });
    },
  },

  // `systemDark` is derived from the device, so only the preference is stored.
  persist: { pick: ['family', 'mode'] },
});
