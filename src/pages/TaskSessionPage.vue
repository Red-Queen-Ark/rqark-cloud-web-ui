<template>
  <div data-testid="task-session-page" class="space-y-4">
    <!-- A transcript carries a long heading and a longer subtitle, so the way back
         sits on its own row above them rather than squeezing them into the space
         it leaves. -->
    <div class="space-y-2">
      <RouterLink id="task-session-back-btn" class="btn btn-ghost btn-sm" :to="{ name: 'taskDetail', params: { lang, uuid } }">
        <ArrowLeftIcon class="h-4 w-4" />
        {{ t('tasks.backToTask') }}
      </RouterLink>

      <div class="min-w-0">
        <p data-testid="task-session-title" class="truncate text-sm font-semibold">{{ session?.title || t('tasks.sessionTitle') }}</p>
        <p class="text-base-content/60 truncate text-xs">{{ meta }}</p>
      </div>
    </div>

    <div v-if="loading" class="bg-base-200/60 border-base-300 rounded-box border p-4" :aria-label="t('tasks.loading')">
      <div class="space-y-3">
        <div class="skeleton h-16 w-full"></div>
        <div class="skeleton h-16 w-3/4"></div>
      </div>
    </div>

    <div v-else-if="notFound" data-testid="task-session-not-found" class="bg-base-200/60 border-base-300 rounded-box border">
      <div class="flex flex-col items-center justify-center px-6 py-20 text-center">
        <img src="/logo.svg" alt="" class="mb-4 h-24 w-24 opacity-50" />
        <p class="mb-1 text-xl font-bold">{{ t('tasks.sessionNotFound') }}</p>
        <p class="text-base-content/70 mb-4 max-w-sm text-sm">{{ t('tasks.sessionNotFoundDesc') }}</p>
        <p class="text-base-content/60 font-mono text-xs">{{ sessionId }}</p>
      </div>
    </div>

    <template v-else>
      <ChatPlanCard v-if="planItems.length > 0" :items="planItems" class="shadow-sm" />

      <div data-testid="task-session-history" class="flex flex-col md:mx-4">
        <ChatMessage :messages="messages" />
      </div>

      <p v-if="messages.length === 0" data-testid="task-session-empty" class="text-base-content/70 text-sm">{{ t('tasks.sessionNoMessages') }}</p>

      <p class="text-base-content/60 text-xs">{{ t('tasks.sessionReadOnly') }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getSessionsByUuid, getSessionsByUuidMessages, getTasksByUuid, type ApiSessionDto, type ApiTaskDto } from '@/api';
import { apiErrorCode } from '@/api-client/error';
import ChatMessage from '@/components/Chat/ChatMessage.vue';
import ChatPlanCard from '@/components/Chat/ChatPlanCard.vue';
import ArrowLeftIcon from '@/components/svg/ArrowLeftIcon.vue';
import { useApiError } from '@/composables/useApiError';
import { planItemsFrom } from '@/config/sessions';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
const alertStore = useAlertStore();
const apiError = useApiError();

const lang = computed(() => route.params.lang as string);
const uuid = computed(() => String(route.params.uuid ?? ''));
const sessionId = computed(() => String(route.params.session ?? ''));

const task = ref<ApiTaskDto | null>(null);
const session = ref<ApiSessionDto | null>(null);
const messages = ref<ChatHistoryEntry[]>([]);
const loading = ref(true);
const notFound = ref(false);

const planItems = computed(() => planItemsFrom(session.value?.plan_items));

const meta = computed(() => {
  const parts: string[] = [];
  if (task.value?.name) {
    parts.push(task.value.name);
  }
  if (session.value) {
    parts.push(`${t('tasks.updated')} ${formatDateTime(session.value.updated_at)}`);
  }
  return parts.join(' · ');
});

async function load() {
  loading.value = true;
  notFound.value = false;

  // The task is read for the heading and the back link; the transcript needs the
  // session and its messages, which are two endpoints by design.
  const [taskResult, sessionResult, messagesResult] = await Promise.all([
    getTasksByUuid({ path: { uuid: uuid.value } }),
    getSessionsByUuid({ path: { uuid: sessionId.value } }),
    getSessionsByUuidMessages({ path: { uuid: sessionId.value } }),
  ]);
  loading.value = false;

  task.value = taskResult.data ?? null;

  if (sessionResult.error || !sessionResult.data) {
    session.value = null;
    messages.value = [];
    if (apiErrorCode(sessionResult.error) === 'NOT_FOUND') {
      notFound.value = true;
      return;
    }
    alertStore.addItem({ level: 'error', message: apiError(sessionResult.error, 'tasks.sessionLoadError') });
    return;
  }

  session.value = sessionResult.data;

  if (messagesResult.error || !messagesResult.data) {
    messages.value = [];
    alertStore.addItem({ level: 'error', message: apiError(messagesResult.error, 'tasks.sessionLoadError') });
    return;
  }

  // Each message is stored as the JSON the engine wrote, which is what the chat
  // components read: a run's transcript is drawn with the same components a live
  // chat uses, so the two cannot drift apart.
  messages.value = messagesResult.data as unknown as ChatHistoryEntry[];
}

onMounted(load);
</script>
