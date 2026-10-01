<template>
  <li>
    <span class="menu-title">{{ t('chat.title') }}</span>
    <ul data-testid="sidebar-chat-sessions">
      <li>
        <RouterLink :to="{ name: 'home', params: { lang } }">{{ t('chat.newSession') }}</RouterLink>
      </li>
      <li v-for="session in sessions" :key="session.id">
        <RouterLink v-if="session.id" :to="{ name: 'chat', params: { lang, uuid: session.id } }" :class="{ 'menu-active': isActive(session) }">
          {{ session.title || t('sessions.untitled') }}
        </RouterLink>
        <span v-else>{{ session.title || t('sessions.untitled') }}</span>
      </li>
    </ul>
  </li>
</template>

<script setup lang="ts">
import { getSessions, type ApiSessionDto } from '@/api';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

/** How often the sidebar looks for sessions started somewhere else. */
const POLL_INTERVAL_MS = 5000;

const { t } = useI18n();
const route = useRoute();
const alertStore = useAlertStore();
const apiError = useApiError();

const sessions = ref<ApiSessionDto[]>([]);
const lang = computed(() => route.params.lang as string);

let pollTimer: ReturnType<typeof setInterval> | undefined;
// A backend that stays down would otherwise stack one alert per poll.
let loadFailed = false;

function isActive(session: ApiSessionDto): boolean {
  const uuid = route.params.uuid;
  return route.name === 'chat' && typeof uuid === 'string' && session.id === uuid;
}

function timestamp(value?: string): number {
  return value ? new Date(value).getTime() : 0;
}

/** Newest activity first; a session the engine has not touched falls back to its creation. */
function byRecency(a: ApiSessionDto, b: ApiSessionDto): number {
  return timestamp(b.updated_at ?? b.created_at) - timestamp(a.updated_at ?? a.created_at);
}

async function loadSessions() {
  const { data, error } = await getSessions();
  if (error || !data) {
    if (!loadFailed) {
      loadFailed = true;
      alertStore.addItem({ level: 'error', message: apiError(error, 'chat.loadError') });
    }
    return;
  }
  loadFailed = false;
  // The endpoint hands back its own array, so sort a copy rather than it.
  sessions.value = [...data].sort(byRecency);
}

onMounted(async () => {
  await loadSessions();
  pollTimer = setInterval(loadSessions, POLL_INTERVAL_MS);
});

onUnmounted(() => {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer);
  }
});
</script>
