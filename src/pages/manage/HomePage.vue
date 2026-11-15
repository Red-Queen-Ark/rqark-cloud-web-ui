<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 gap-3">
      <div v-if="isSuperuser" class="stat bg-base-200/60 border-base-300 rounded-box border p-4">
        <div class="stat-figure text-primary">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0017.25 4.5H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25Zm.75-12h9v9h-9v-9Z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
        <div class="stat-title text-xs">{{ t('dashboard.totalAgents') }}</div>
        <div class="stat-value text-primary text-2xl">{{ statText(stats.agents) }}</div>
        <div class="stat-desc text-xs">{{ t('agents.subtitle') }}</div>
      </div>

      <div v-if="isSuperuser" class="stat bg-base-200/60 border-base-300 rounded-box border p-4">
        <div class="stat-figure text-primary">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008Zm-3 0h.008v.008h-.008v-.008Z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
        <div class="stat-title text-xs">{{ t('dashboard.totalProviders') }}</div>
        <div class="stat-value text-primary text-2xl">{{ statText(stats.providers) }}</div>
        <div class="stat-desc text-xs">{{ t('providers.subtitle') }}</div>
      </div>

      <div class="stat bg-base-200/60 border-base-300 rounded-box border p-4">
        <div class="stat-figure text-primary">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
        <div class="stat-title text-xs">{{ t('dashboard.totalSessions') }}</div>
        <div class="stat-value text-primary text-2xl">{{ statText(stats.sessions) }}</div>
        <div class="stat-desc text-xs">{{ t('sessions.subtitle') }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div class="card bg-base-200/60 border-base-300 border lg:col-span-2">
        <div class="card-body gap-3 p-4 sm:p-6">
          <h2 class="card-title text-base">{{ t('dashboard.welcome', { name: authStore.displayName || t('user.display') }) }}</h2>
          <p class="text-base-content/70 text-sm">{{ t('dashboard.subtitle') }}</p>

          <div class="flex flex-wrap gap-2">
            <RouterLink :to="{ name: 'settings' }" class="btn btn-outline btn-sm">{{ t('settings.title') }}</RouterLink>
            <RouterLink v-if="isSuperuser" :to="{ name: 'users' }" class="btn btn-outline btn-sm">{{ t('users.title') }}</RouterLink>
            <RouterLink v-if="isSuperuser" :to="{ name: 'groups' }" class="btn btn-outline btn-sm">{{ t('groups.title') }}</RouterLink>
          </div>
        </div>
      </div>

      <div class="card bg-base-200/60 border-base-300 border">
        <div class="card-body gap-3 p-4">
          <h2 class="card-title text-base">{{ t('dashboard.yourAccount') }}</h2>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-base-content/70">{{ t('settings.username') }}</dt>
              <dd class="truncate font-medium">{{ authStore.user?.username || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-base-content/70">{{ t('settings.email') }}</dt>
              <dd class="truncate font-medium">{{ authStore.user?.email || '—' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4">
              <dt class="text-base-content/70">{{ t('users.roles') }}</dt>
              <dd class="space-x-1">
                <span v-if="isSuperuser" class="badge badge-primary badge-xs">{{ t('users.superuser') }}</span>
                <span v-if="authStore.user?.is_staff" class="badge badge-secondary badge-xs">{{ t('users.staff') }}</span>
                <span v-if="!isSuperuser && !authStore.user?.is_staff" class="badge badge-ghost badge-xs">{{ t('users.member') }}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAgents, getProviders, getSessions } from '@/api';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { computed, onMounted, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const authStore = useAuthStore();
const alertStore = useAlertStore();

const isSuperuser = computed(() => authStore.user?.is_superuser === true);

const stats = reactive<{ agents?: number; providers?: number; sessions?: number }>({});

function statText(value?: number): string {
  return typeof value === 'number' ? String(value) : '--';
}

onMounted(async () => {
  const [sessions, agents, providers] = await Promise.all([getSessions(), isSuperuser.value ? getAgents() : Promise.resolve(undefined), isSuperuser.value ? getProviders() : Promise.resolve(undefined)]);

  if (sessions.data) {
    stats.sessions = sessions.data.length;
  }
  if (agents?.data) {
    stats.agents = agents.data.length;
  }
  if (providers?.data) {
    stats.providers = providers.data.length;
  }

  const failure = sessions.error ?? agents?.error ?? providers?.error;
  if (failure) {
    alertStore.addItem({ level: 'error', message: t('dashboard.statsError') });
  }
});
</script>
