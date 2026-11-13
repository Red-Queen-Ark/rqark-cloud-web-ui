<template>
  <div class="relative h-full">
    <div class="absolute right-4 top-4 z-50 flex gap-1">
      <LoginServerSettings v-if="desktop" ref="serverSettings" />
      <LanguageSwitcher />
      <ThemeSwitcher />
    </div>
    <LoginBox v-model:username="username" v-model:password="password" :loading="loading" :allow-registration="allowRegistration" @login="login" />
  </div>
</template>

<script setup lang="ts">
import { getSystemConfig } from '@/api';
import LoginBox from '@/components/Login/LoginBox.vue';
import LoginServerSettings from '@/components/Login/LoginServerSettings.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import { isDesktop, serverConfig } from '@/config/runtime';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const authStore = useAuthStore();
const alertStore = useAlertStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const username = ref<string>('');
const password = ref<string>('');
const loading = ref(false);
const allowRegistration = ref(false);

const desktop = isDesktop();
const serverSettings = ref<InstanceType<typeof LoginServerSettings> | null>(null);

onMounted(async () => {
  try {
    const { data, response } = await getSystemConfig();
    if (!response?.ok) {
      throw new Error('bad status');
    }
    allowRegistration.value = Boolean(data?.allow_self_registration);
  } catch {
    if (desktop) {
      serverSettings.value?.open();
      alertStore.addItem({ level: 'error', message: t('settings.serversUnreachable', { url: serverConfig().apiBaseUrl }) });
    }
  }
});

async function login() {
  if (!username.value || !password.value) {
    alertStore.addItem({ level: 'warning', message: t('login.emptyFields') });
    return;
  }

  loading.value = true;
  const { ok } = await authStore.login({ login: username.value, password: password.value });
  loading.value = false;

  if (!ok) {
    alertStore.addItem({ level: 'error', message: t('login.error') });
    return;
  }

  router.push({ name: 'home', params: { lang: route.params.lang as string } });
}
</script>
