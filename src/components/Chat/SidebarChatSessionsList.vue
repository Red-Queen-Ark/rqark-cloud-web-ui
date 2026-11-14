<template>
  <SidebarProjectsList :sessions="sessions" :lang="lang" :active-session-id="activeSessionId" @deleted="handleDeleted" />

  <li class="session-group min-w-0" data-testid="sidebar-chat-sessions">
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="text-base-content/70 hover:text-base-content flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-xs font-semibold tracking-wide uppercase"
        :aria-expanded="expanded"
        data-testid="sidebar-chat-sessions-toggle"
        @click="expanded = !expanded"
      >
        <ChevronRightIcon class="h-3 w-3 shrink-0 transition-transform" :class="{ 'rotate-90': expanded }" />
        <span class="truncate">{{ t('chat.title') }}</span>
        <span v-if="unfiled.length > 0" class="text-base-content/40 shrink-0 tabular-nums">{{ unfiled.length }}</span>
      </button>
    </div>

    <ul v-if="expanded" class="min-w-0" data-testid="sidebar-chat-session-list">
      <li>
        <RouterLink :to="{ name: 'home', params: { lang } }" :class="{ 'menu-active': isHome }" data-testid="sidebar-chat-new">
          <PlusIcon class="h-4 w-4" />
          {{ t('chat.newSession') }}
        </RouterLink>
      </li>
      <SidebarSessionRow v-for="session in unfiled" :key="session.id" :session="session" :lang="lang" :active="isActive(session)" @deleted="handleDeleted" @renamed="handleRenamed" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { getSessions, type ApiSessionDto } from '@/api';
import ChevronRightIcon from '@/components/svg/ChevronRightIcon.vue';
import PlusIcon from '@/components/svg/PlusIcon.vue';
import { useApiError } from '@/composables/useApiError';
import { SESSION_SOURCE } from '@/config/sessionSource';
import { useAlertStore } from '@/stores/alertStore';
import { useChatStore } from '@/stores/chatStore';
import { useProjectStore } from '@/stores/projectStore';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import SidebarProjectsList from './SidebarProjectsList.vue';
import SidebarSessionRow from './SidebarSessionRow.vue';

/** How often the sidebar looks for sessions started somewhere else. */
const POLL_INTERVAL_MS = 5000;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const alertStore = useAlertStore();
const apiError = useApiError();
const chatStore = useChatStore();
const projectStore = useProjectStore();

/**
 * Every chat session, both groups read from here. Kept whole rather than fetched
 * per group: one list is one request, and a session that moves between groups
 * moves without a second round trip.
 */
const sessions = ref<ApiSessionDto[]>([]);
const expanded = ref(true);
const lang = computed(() => route.params.lang as string);
/** The create action owns the home route, which is where a session is started. */
const isHome = computed(() => route.name === 'home');
const activeSessionId = computed(() => (typeof route.params.uuid === 'string' ? route.params.uuid : undefined));

/** The sessions that belong to no project: the ones started before projects existed. */
const unfiled = computed(() => sessions.value.filter((session) => !session.project_id));

let pollTimer: ReturnType<typeof setInterval> | undefined;
// A backend that stays down would otherwise stack one alert per poll.
let loadFailed = false;

function isActive(session: ApiSessionDto): boolean {
  return route.name === 'chat' && Boolean(session.id) && session.id === activeSessionId.value;
}

function timestamp(value?: string): number {
  return value ? new Date(value).getTime() : 0;
}

/** Newest activity first; a session the engine has not touched falls back to its creation. */
function byRecency(a: ApiSessionDto, b: ApiSessionDto): number {
  return timestamp(b.updated_at ?? b.created_at) - timestamp(a.updated_at ?? a.created_at);
}

async function loadSessions() {
  const { data, error } = await getSessions({ query: { source: SESSION_SOURCE } });
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
  chatStore.setSessionTitles(sessions.value);
  chatStore.setSessionProjects(sessions.value);
}

function handleRenamed(id: string, title: string) {
  const session = sessions.value.find((candidate) => candidate.id === id);
  if (session) {
    session.title = title;
  }
}

function handleDeleted(id: string) {
  sessions.value = sessions.value.filter((session) => session.id !== id);
  // The chat route would otherwise keep pointing at a session that no longer exists.
  if (route.name === 'chat' && route.params.uuid === id) {
    void router.push({ name: 'home', params: { lang: lang.value } });
  }
}

onMounted(async () => {
  await Promise.all([loadSessions(), projectStore.load()]);
  pollTimer = setInterval(loadSessions, POLL_INTERVAL_MS);
});

onUnmounted(() => {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer);
  }
});
</script>

<style scoped>
/* daisyUI's .menu turns every li into a wrapping flex column and the nested
   list into `white-space: nowrap`. Both size a row by the longest title's
   max-content, so one long name pushes the whole menu wider than the sidebar
   and the text runs off the edge instead of ellipsizing. Plain block rows,
   sized by the panel, keep the titles inside it.

   Scoped to the session rows themselves: the kebab dropdown is nested inside
   one of those rows, and it needs daisyUI's own grid item to stretch each
   action to the menu's width. */
.session-group,
.session-group > ul,
.session-group > ul > li {
  display: block;
  max-width: 100%;
  min-width: 0;
  white-space: normal;
}

.session-group :deep(ul > li > a) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
</style>
