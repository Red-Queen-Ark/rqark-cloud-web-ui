<template>
  <div id="language-switcher" class="dropdown dropdown-end">
    <button id="language-switcher-btn" tabindex="0" class="btn btn-ghost btn-sm gap-1 px-1 sm:px-2" :aria-label="t('nav.switchLanguage')">
      <GlobeIcon class="h-4 w-4" />
      <span>{{ current.short }}</span>
      <ChevronDownIcon class="hidden h-3 w-3 opacity-50 sm:block" />
    </button>

    <ul tabindex="0" class="dropdown-content menu bg-base-200 border-base-300 rounded-box z-50 mt-2 w-44 border shadow-lg">
      <li class="menu-title px-4 pt-2 text-xs opacity-60">{{ t('nav.language') }}</li>
      <li v-for="option in LANGUAGES" :key="option.value">
        <button :class="{ 'menu-active': option.value === locale }" class="transition-colors duration-150 focus-visible:bg-base-300 focus-visible:outline-none" @click="select(option.value)">
          {{ option.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import ChevronDownIcon from '@/components/svg/ChevronDownIcon.vue';
import GlobeIcon from '@/components/svg/GlobeIcon.vue';
import { LANGUAGES, languageOption } from '@/config/languages';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();

const current = computed(() => languageOption(locale.value));

function select(value: string) {
  // The menu opens through :focus-within, and daisyUI disables pointer events on
  // an open dropdown's trigger, so the focus has to be released to close it.
  (document.activeElement as HTMLElement | null)?.blur();

  if (value === locale.value) {
    return;
  }
  // Keep the query string so deep links such as the reset-password token survive
  // a language switch.
  void router.push({ name: route.name, params: { lang: value }, query: route.query });
}
</script>
