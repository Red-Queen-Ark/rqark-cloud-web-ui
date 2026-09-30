<template>
  <div class="relative h-full">
    <div class="absolute right-4 top-4 z-50 flex gap-1">
      <LanguageSwitcher />
      <ThemeSwitcher />
    </div>

    <AuthPanel :title="t('forgotPassword.title')" :subtitle="t('forgotPassword.subtitle')">
      <form class="space-y-5" @submit.prevent="submit">
        <label class="fieldset">
          <span class="fieldset-legend">{{ t('forgotPassword.email') }}</span>
          <input id="forgot-email" v-model="email" type="email" autocomplete="email" class="input w-full" :placeholder="t('forgotPassword.emailPlaceholder')" required />
        </label>

        <button type="submit" class="btn btn-primary mt-3 w-full" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-sm"></span>
          {{ t('forgotPassword.submit') }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-base-content/75">
        <RouterLink :to="{ name: 'login', params: { lang: route.params.lang } }" class="link link-primary">
          {{ t('forgotPassword.backToLogin') }}
        </RouterLink>
      </p>
    </AuthPanel>
  </div>
</template>

<script setup lang="ts">
import { postAuthForgotPassword } from '@/api';
import AuthPanel from '@/components/Auth/AuthPanel.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const alertStore = useAlertStore();
const apiError = useApiError();
const route = useRoute();
const { t } = useI18n();

const email = ref('');
const loading = ref(false);

async function submit() {
  loading.value = true;
  const { error } = await postAuthForgotPassword({ body: { email: email.value } });
  loading.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'forgotPassword.error') });
    return;
  }

  // The backend answers 204 whether or not the address exists, so the UI must
  // not reveal which one it was.
  alertStore.addItem({ level: 'success', message: t('forgotPassword.sent') });
}
</script>
