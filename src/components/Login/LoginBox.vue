<template>
  <AuthPanel :title="t('login.title')" :subtitle="t('login.subtitle')">
    <form class="space-y-5" @submit.prevent="emit('login')">
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('login.username') }}</span>
        <input id="login-username" v-model="username" type="text" autocomplete="username" class="input w-full" :placeholder="t('login.usernamePlaceholder')" required />
      </label>

      <label class="fieldset">
        <span class="fieldset-legend">{{ t('login.password') }}</span>
        <input id="login-password" v-model="password" type="password" autocomplete="current-password" class="input w-full" :placeholder="t('login.passwordPlaceholder')" required />
      </label>

      <div class="text-right">
        <RouterLink
          :to="{ name: 'forgotPassword', params: { lang: route.params.lang } }"
          class="rounded-sm text-xs text-base-content/70 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {{ t('login.forgotPassword') }}
        </RouterLink>
      </div>

      <button type="submit" class="btn btn-primary mt-3 w-full" :disabled="loading">
        <span v-if="loading" class="loading loading-spinner loading-sm"></span>
        {{ t('login.submit') }}
      </button>
    </form>

    <p v-if="allowRegistration" class="mt-6 text-center text-sm text-base-content/75">
      {{ t('login.noAccount') }}
      <RouterLink :to="{ name: 'register', params: { lang: route.params.lang } }" class="link link-primary">
        {{ t('login.register') }}
      </RouterLink>
    </p>
  </AuthPanel>
</template>

<script setup lang="ts">
import AuthPanel from '@/components/Auth/AuthPanel.vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

withDefaults(
  defineProps<{
    loading?: boolean;
    allowRegistration?: boolean;
  }>(),
  { loading: false, allowRegistration: false },
);

const username = defineModel<string>('username', { default: '' });
const password = defineModel<string>('password', { default: '' });

const emit = defineEmits<{
  login: [];
}>();

const route = useRoute();
const { t } = useI18n();
</script>
