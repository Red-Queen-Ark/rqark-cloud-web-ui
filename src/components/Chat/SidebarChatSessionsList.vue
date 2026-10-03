<template>
  <li ref="rootEl">
    <span class="menu-title">{{ t('chat.title') }}</span>
    <ul data-testid="sidebar-chat-sessions">
      <li>
        <RouterLink :to="{ name: 'home', params: { lang } }">{{ t('chat.newSession') }}</RouterLink>
      </li>
      <li v-for="session in sessions" :key="session.id" class="group relative">
        <template v-if="session.id">
          <RouterLink :to="{ name: 'chat', params: { lang, uuid: session.id } }" :class="{ 'menu-active': isActive(session), invisible: editingId === session.id }" class="min-w-0 pr-8">
            <span class="min-w-0 truncate">{{ session.title || t('sessions.untitled') }}</span>
          </RouterLink>

          <div class="pointer-events-none absolute inset-y-0 right-1 flex items-center hover:bg-transparent active:bg-transparent" :class="{ invisible: editingId === session.id }">
            <SidebarChatSessionMenu :session-id="session.id" :active="isActive(session)" @edit="startEdit(session)" @deleted="handleDeleted" />
          </div>

          <div v-if="editingId === session.id" class="absolute inset-0 flex! items-center gap-1 px-3">
            <input v-model="editTitle" :data-edit-id="session.id" type="text" class="input input-sm w-full min-w-0" :placeholder="t('chat.titlePlaceholder')" @keydown="handleEditKeydown($event, session.id)" @blur="saveEdit(session.id)" />
            <button data-testid="sidebar-chat-rename-save" class="btn btn-ghost btn-sm btn-square text-success" :title="t('chat.edit')" @mousedown.prevent @click="saveEdit(session.id)">
              <CheckIcon class="h-3.5 w-3.5" />
            </button>
            <button data-testid="sidebar-chat-rename-cancel" class="btn btn-ghost btn-sm btn-square text-error" :title="t('chat.cancel')" @mousedown.prevent @click="cancelEdit">
              <CloseIcon class="h-3.5 w-3.5" />
            </button>
          </div>
        </template>
        <span v-else class="truncate">{{ session.title || t('sessions.untitled') }}</span>
      </li>
    </ul>
  </li>
</template>

<script setup lang="ts">
import { getSessions, putSessionsByUuid, type ApiSessionDto } from '@/api';
import CheckIcon from '@/components/svg/CheckIcon.vue';
import CloseIcon from '@/components/svg/CloseIcon.vue';
import SidebarChatSessionMenu from '@/components/Chat/SidebarChatSessionMenu.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { useChatStore } from '@/stores/chatStore';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

/** How often the sidebar looks for sessions started somewhere else. */
const POLL_INTERVAL_MS = 5000;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const alertStore = useAlertStore();
const apiError = useApiError();
const chatStore = useChatStore();

const sessions = ref<ApiSessionDto[]>([]);
const lang = computed(() => route.params.lang as string);

const rootEl = ref<HTMLElement | null>(null);
/** Session being renamed in place, if any. */
const editingId = ref<string | null>(null);
const editTitle = ref('');
const savingId = ref<string | null>(null);

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
  chatStore.setSessionTitles(sessions.value);
}

function startEdit(session: ApiSessionDto) {
  if (!session.id) {
    return;
  }
  editingId.value = session.id;
  editTitle.value = session.title ?? '';
  nextTick(() => {
    const input = rootEl.value?.querySelector<HTMLInputElement>(`[data-edit-id="${session.id}"]`);
    // preventScroll: the row is already visible, and letting focus scroll the list is itself a visible jump.
    input?.focus({ preventScroll: true });
    input?.select();
  });
}

function cancelEdit() {
  editingId.value = null;
  editTitle.value = '';
}

function handleEditKeydown(event: KeyboardEvent, id?: string) {
  if (!id) {
    return;
  }
  if (event.key === 'Enter') {
    saveEdit(id);
  } else if (event.key === 'Escape') {
    cancelEdit();
  }
}

async function saveEdit(id?: string) {
  if (!id || savingId.value) {
    return;
  }
  const title = editTitle.value.trim();
  const session = sessions.value.find((candidate) => candidate.id === id);
  // An unchanged or emptied title is treated as a cancel, matching the app's other inline edits.
  if (!session || !title || session.title === title) {
    cancelEdit();
    return;
  }
  savingId.value = id;
  try {
    const { error } = await putSessionsByUuid({ path: { uuid: id }, body: { title } });
    if (error) {
      alertStore.addItem({ level: 'error', message: apiError(error, 'chat.renameError') });
      return;
    }
    // Re-resolve after the await: a poll may have replaced the array in the meantime.
    const current = sessions.value.find((candidate) => candidate.id === id);
    if (current) {
      current.title = title;
      chatStore.setSessionTitle(id, title);
    }
    cancelEdit();
  } finally {
    savingId.value = null;
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
  await loadSessions();
  pollTimer = setInterval(loadSessions, POLL_INTERVAL_MS);
});

onUnmounted(() => {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer);
  }
});
</script>
