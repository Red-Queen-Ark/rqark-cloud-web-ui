<template>
  <div class="dropdown dropdown-end">
    <button id="theme-switcher" tabindex="0" class="btn btn-ghost btn-sm gap-1">
      <PaintBrushIcon class="h-4 w-4" />
      <span class="hidden sm:inline">{{ currentLabel }}</span>
      <ChevronDownIcon class="h-3 w-3 opacity-50" />
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
          <ThemeModeIcon :mode="mode" class="h-4 w-4" />
          {{ t(`theme.${mode}`) }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import ChevronDownIcon from '@/components/svg/ChevronDownIcon.vue';
import PaintBrushIcon from '@/components/svg/PaintBrushIcon.vue';
import ThemeModeIcon from '@/components/svg/ThemeModeIcon.vue';
import { useThemeStore, THEME_FAMILIES, THEME_MODES } from '@/stores/themeStore';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const { t } = useI18n();
const store = useThemeStore();

const families = THEME_FAMILIES;
const modes = THEME_MODES;

const currentLabel = computed(() => {
  const f = families.find((f) => f.value === store.family);
  return f?.label || '';
});
</script>
