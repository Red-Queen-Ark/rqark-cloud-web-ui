<template>
  <div class="relative h-full">
    <div class="absolute right-4 top-4 z-50 flex gap-1">
      <LanguageSwitcher />
      <ThemeSwitcher />
    </div>

    <AuthPanel :title="t('resetPassword.title')" :subtitle="t('resetPassword.subtitle')">
      <div v-if="!token" role="alert" class="alert alert-error">
        <span>{{ t('resetPassword.missingToken') }}</span>
      </div>

      <form v-else class="space-y-5" @submit.prevent="submit">
        <label class="fieldset">
          <span class="fieldset-legend">{{ t('resetPassword.password') }}</span>
          <input id="reset-password" v-model="password" type="password" autocomplete="new-password" class="input w-full" :placeholder="t('resetPassword.passwordPlaceholder')" required />
        </label>

        <label class="fieldset">
          <span class="fieldset-legend">{{ t('resetPassword.confirmPassword') }}</span>
          <input id="reset-confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" class="input w-full" :placeholder="t('resetPassword.passwordPlaceholder')" required />
        </label>

        <button type="submit" class="btn btn-primary mt-3 w-full" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-sm"></span>
          {{ t('resetPassword.submit') }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-base-content/75">
        <RouterLink :to="{ name: 'login', params: { lang: route.params.lang } }" class="link link-primary">
          {{ t('resetPassword.backToLogin') }}
        </RouterLink>
      </p>
    </AuthPanel>
  </div>
</template>

<script setup lang="ts">
import { postAuthResetPassword } from '@/api';
import AuthPanel from '@/components/Auth/AuthPanel.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const alertStore = useAlertStore();
const apiError = useApiError();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);

async function submit() {
  if (password.value !== confirmPassword.value) {
    alertStore.addItem({ level: 'warning', message: t('resetPassword.passwordMismatch') });
    return;
  }

  loading.value = true;
  const { error } = await postAuthResetPassword({ body: { token: token.value, new_password: password.value } });
  loading.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'resetPassword.error') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('resetPassword.success') });
  router.push({ name: 'login', params: { lang: route.params.lang as string } });
}
</script>
