<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div class="card bg-base-200/60 border-base-300 border">
        <div class="card-body gap-3 p-4 sm:p-6">
          <h2 class="card-title text-base">{{ t('settings.profile') }}</h2>

          <label class="fieldset">
            <span class="fieldset-legend">{{ t('settings.username') }}</span>
            <input id="settings-username" v-model="profile.username" type="text" class="input w-full" />
          </label>

          <label class="fieldset">
            <span class="fieldset-legend">{{ t('settings.email') }}</span>
            <input id="settings-email" v-model="profile.email" type="email" class="input w-full" />
          </label>

          <label class="fieldset">
            <span class="fieldset-legend">{{ t('settings.displayName') }}</span>
            <input id="settings-display-name" v-model="profile.displayName" type="text" class="input w-full" />
          </label>
        </div>
      </div>

      <div class="card bg-base-200/60 border-base-300 border">
        <div class="card-body gap-3 p-4 sm:p-6">
          <h2 class="card-title text-base">{{ t('settings.password') }}</h2>
          <p class="text-base-content/60 text-xs">{{ t('settings.passwordHint') }}</p>

          <label class="fieldset">
            <span class="fieldset-legend">{{ t('settings.currentPassword') }}</span>
            <input id="settings-current-password" v-model="passwordForm.oldPassword" type="password" autocomplete="current-password" class="input w-full" />
          </label>

          <label class="fieldset">
            <span class="fieldset-legend">{{ t('settings.newPassword') }}</span>
            <input id="settings-new-password" v-model="passwordForm.newPassword" type="password" autocomplete="new-password" class="input w-full" />
          </label>

          <label class="fieldset">
            <span class="fieldset-legend">{{ t('settings.confirmPassword') }}</span>
            <input id="settings-confirm-password" v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" class="input w-full" />
          </label>
        </div>
      </div>
    </div>

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

    <div class="bg-base-200/60 border-base-300 rounded-box sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border p-3">
      <span class="text-base-content/60 text-xs sm:mr-auto">{{ t('settings.saveHint') }}</span>
      <button id="settings-save-btn" class="btn btn-primary" :disabled="saving" @click="save">
        <span v-if="saving" class="loading loading-spinner loading-sm"></span>
        <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
        </svg>
        {{ t('settings.save') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LANGUAGES, languageOption } from '@/config/languages';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
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
const alertStore = useAlertStore();
const apiError = useApiError();

const profile = reactive({ username: '', email: '', displayName: '' });
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });

const saving = ref(false);
const selectedFamily = ref<string>(themeStore.family);
const selectedMode = ref<ThemeMode>(themeStore.mode);
const selectedLanguage = ref(languageOption(locale.value).value);

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

function wantsPasswordChange(): boolean {
  return Boolean(passwordForm.oldPassword || passwordForm.newPassword || passwordForm.confirmPassword);
}

async function save() {
  if (wantsPasswordChange()) {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      alertStore.addItem({ level: 'warning', message: t('settings.passwordRequired') });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alertStore.addItem({ level: 'warning', message: t('settings.passwordMismatch') });
      return;
    }
  }

  saving.value = true;

  const profileResult = await authStore.updateProfile({
    username: profile.username,
    email: profile.email,
    display_name: profile.displayName,
  });

  const passwordResult = wantsPasswordChange() ? await authStore.changePassword({ old_password: passwordForm.oldPassword, new_password: passwordForm.newPassword }) : undefined;

  saving.value = false;

  if (!profileResult.ok) {
    alertStore.addItem({ level: 'error', message: apiError(profileResult.error, 'settings.profileError') });
  }
  if (passwordResult && !passwordResult.ok) {
    alertStore.addItem({ level: 'error', message: apiError(passwordResult.error, 'settings.passwordError') });
  }
  if (!profileResult.ok || (passwordResult && !passwordResult.ok)) {
    return;
  }

  if (passwordResult) {
    passwordForm.oldPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
    alertStore.addItem({ level: 'success', message: t('settings.savedWithPassword') });
    return;
  }
  alertStore.addItem({ level: 'success', message: t('settings.profileSaved') });
}

onMounted(() => {
  profile.username = authStore.user?.username ?? '';
  profile.email = authStore.user?.email ?? '';
  profile.displayName = authStore.user?.display_name ?? '';
  selectedFamily.value = themeStore.family;
  selectedMode.value = themeStore.mode;
  selectedLanguage.value = languageOption(locale.value).value;
});

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
