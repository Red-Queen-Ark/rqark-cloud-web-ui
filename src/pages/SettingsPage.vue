<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div class="card bg-base-200/60 border-base-300 border">
        <div class="card-body gap-3 p-4 sm:p-6">
          <h2 class="card-title text-base">{{ t('settings.appearance') }}</h2>

          <label class="fieldset">
            <span class="fieldset-legend">{{ t('theme.family') }}</span>
            <select id="settings-theme" v-model="selectedFamily" class="select w-full max-w-xs" @change="applyTheme">
              <option disabled value="">{{ t('theme.family') }}</option>
              <option v-for="f in THEME_FAMILIES" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>
          </label>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('theme.mode') }}</legend>
            <div class="flex flex-wrap gap-2">
              <button v-for="mode in THEME_MODES" :id="`settings-mode-${mode}`" :key="mode" :class="selectedMode === mode ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'" @click="applyMode(mode)">
                {{ t(`theme.${mode}`) }}
              </button>
            </div>
          </fieldset>

          <p class="text-base-content/60 mt-auto text-xs">{{ t('settings.appearanceHint') }}</p>
        </div>
      </div>

      <div class="card bg-base-200/60 border-base-300 border">
        <div class="card-body gap-3 p-4 sm:p-6">
          <h2 class="card-title text-base">{{ t('settings.language') }}</h2>

          <label class="fieldset w-full">
            <span class="fieldset-legend">{{ t('nav.language') }}</span>
            <select id="settings-language" v-model="selectedLanguage" class="select w-full max-w-xs" @change="applyLanguage">
              <option v-for="option in LANGUAGES" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>

          <p class="text-base-content/60 mt-auto text-xs">{{ t('settings.languageHint') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LANGUAGES, languageOption } from '@/config/languages';
import { useAuthStore } from '@/stores/authStore';
import { THEME_FAMILIES, THEME_MODES, useThemeStore, type ThemeMode } from '@/stores/themeStore';
import { onMounted, ref, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const authStore = useAuthStore();

const profile = reactive({ username: '', email: '', displayName: '' });
const selectedFamily = ref<string>(themeStore.family);
const selectedMode = ref<ThemeMode>(themeStore.mode);
const selectedLanguage = ref(languageOption(locale.value).value);

// Appearance and language are device preferences with no API behind them, so
// they apply on change and the single Save button only writes the account.
function applyTheme() {
  themeStore.setFamily(selectedFamily.value as typeof themeStore.family);
}

function applyMode(mode: ThemeMode) {
  selectedMode.value = mode;
  themeStore.setMode(mode);
}

function applyLanguage() {
  if (selectedLanguage.value === locale.value) {
    return;
  }
  void router.push({ name: route.name, params: { lang: selectedLanguage.value }, query: route.query });
}

onMounted(() => {
  profile.username = authStore.user?.username ?? '';
  profile.email = authStore.user?.email ?? '';
  profile.displayName = authStore.user?.display_name ?? '';
  selectedFamily.value = themeStore.family;
  selectedMode.value = themeStore.mode;
  selectedLanguage.value = languageOption(locale.value).value;
});

// The header switchers can change these while the page is open.
watch(locale, (value) => {
  selectedLanguage.value = languageOption(value).value;
});

watch(
  () => [themeStore.family, themeStore.mode] as const,
  ([family, mode]) => {
    selectedFamily.value = family;
    selectedMode.value = mode;
  },
);
</script>
