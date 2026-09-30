<template>
  <div class="relative h-full">
    <div class="absolute right-4 top-4 z-50 flex gap-1">
      <LanguageSwitcher />
      <ThemeSwitcher />
    </div>

    <AuthPanel :title="t('register.title')" :subtitle="t('register.subtitle')">
      <form class="space-y-5" @submit.prevent="submit">
        <label class="fieldset">
          <span class="fieldset-legend">{{ t('register.username') }}</span>
          <input id="register-username" v-model="username" type="text" autocomplete="username" class="input w-full" :placeholder="t('register.usernamePlaceholder')" required />
        </label>

        <label class="fieldset">
          <span class="fieldset-legend">{{ t('register.email') }}</span>
          <input id="register-email" v-model="email" type="email" autocomplete="email" class="input w-full" :placeholder="t('register.emailPlaceholder')" required />
        </label>

        <label class="fieldset">
          <span class="fieldset-legend">{{ t('register.displayName') }}</span>
          <input id="register-display-name" v-model="displayName" type="text" autocomplete="name" class="input w-full" :placeholder="t('register.displayNamePlaceholder')" />
        </label>

        <label class="fieldset">
          <span class="fieldset-legend">{{ t('register.password') }}</span>
          <input id="register-password" v-model="password" type="password" autocomplete="new-password" class="input w-full" :placeholder="t('register.passwordPlaceholder')" required />
        </label>

        <label class="fieldset">
          <span class="fieldset-legend">{{ t('register.confirmPassword') }}</span>
          <input id="register-confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" class="input w-full" :placeholder="t('register.passwordPlaceholder')" required />
        </label>

        <button type="submit" class="btn btn-primary mt-3 w-full" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-sm"></span>
          {{ t('register.submit') }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-base-content/75">
        {{ t('register.haveAccount') }}
        <RouterLink :to="{ name: 'login', params: { lang: route.params.lang } }" class="link link-primary">
          {{ t('register.signIn') }}
        </RouterLink>
      </p>
    </AuthPanel>
  </div>
</template>

<script setup lang="ts">
import AuthPanel from '@/components/Auth/AuthPanel.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const authStore = useAuthStore();
const alertStore = useAlertStore();
const apiError = useApiError();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const username = ref('');
const email = ref('');
const displayName = ref('');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);

async function submit() {
  if (password.value !== confirmPassword.value) {
    alertStore.addItem({ level: 'warning', message: t('register.passwordMismatch') });
    return;
  }

  loading.value = true;
  const { ok, error } = await authStore.register({
    username: username.value,
    email: email.value,
    display_name: displayName.value,
    password: password.value,
  });
  loading.value = false;

  if (!ok) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'register.error') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('register.success') });
  router.push({ name: 'login', params: { lang: route.params.lang as string } });
}
</script>
