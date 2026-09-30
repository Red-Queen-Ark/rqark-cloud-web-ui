<template>
  <div class="dropdown dropdown-end">
    <button id="theme-switcher" tabindex="0" class="btn btn-ghost btn-sm gap-1">
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
      </svg>
      <span class="hidden sm:inline">{{ currentLabel }}</span>
      <svg class="h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
      </svg>
    </button>

    <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-50 mt-2 w-48 shadow-lg">
      <li class="menu-title px-4 pt-2 text-xs opacity-60">{{ t('theme.family') }}</li>
      <li v-for="f in families" :key="f.value">
        <button :class="{ active: store.family === f.value }" class="transition-colors duration-150 focus-visible:bg-base-300 focus-visible:outline-none" @click="store.setFamily(f.value)">
          {{ f.label }}
        </button>
      </li>
      <li class="menu-title mt-1 px-4 text-xs opacity-60">{{ t('theme.mode') }}</li>
      <li v-for="mode in modes" :key="mode">
        <button :id="`theme-mode-${mode}`" :class="{ active: store.mode === mode }" class="transition-colors duration-150 focus-visible:bg-base-300 focus-visible:outline-none" @click="store.setMode(mode)">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path :d="MODE_ICONS[mode]" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
          {{ t(`theme.${mode}`) }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useThemeStore, THEME_FAMILIES, THEME_MODES, type ThemeMode } from '@/stores/themeStore';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const { t } = useI18n();
const store = useThemeStore();

const families = THEME_FAMILIES;
const modes = THEME_MODES;

/** Heroicons outline paths, one per mode. */
const MODE_ICONS: Record<ThemeMode, string> = {
  light: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  dark: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  system:
    'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
};

const currentLabel = computed(() => {
  const f = families.find((f) => f.value === store.family);
  return f?.label || '';
});
</script>
