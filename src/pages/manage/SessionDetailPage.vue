<template>
  <div class="space-y-4">
    <DataToolbar>
      <RouterLink id="session-detail-back-btn" class="btn btn-ghost btn-sm" :to="{ name: 'sessions', params: { lang: route.params.lang } }">
        <ArrowLeftIcon class="h-4 w-4" />
        {{ t('sessions.back') }}
      </RouterLink>

      <div class="min-w-0">
        <p class="truncate text-sm font-semibold">{{ session?.title || t('sessions.untitled') }}</p>
        <p class="text-base-content/60 truncate text-xs">{{ meta }}</p>
      </div>
    </DataToolbar>

    <div v-if="loading" data-testid="session-detail-loading" class="bg-base-200/60 border-base-300 rounded-box border p-4" :aria-label="t('sessions.detailLoading')">
      <div class="space-y-3">
        <div class="skeleton h-16 w-full"></div>
        <div class="skeleton h-16 w-3/4"></div>
        <div class="skeleton h-16 w-1/2"></div>
      </div>
    </div>

    <div v-else-if="notFound" class="bg-base-200/60 border-base-300 rounded-box border">
      <div class="flex flex-col items-center justify-center px-6 py-20 text-center">
        <img src="/logo.svg" alt="" class="mb-4 h-24 w-24 opacity-50" />
        <p class="mb-1 text-xl font-bold">{{ t('sessions.detailNotFound') }}</p>
        <p class="text-base-content/70 mb-4 max-w-sm text-sm">{{ t('sessions.detailNotFoundDesc') }}</p>
        <p class="text-base-content/60 font-mono text-xs">{{ t('sessions.sessionId') }}: {{ uuid }}</p>
      </div>
    </div>

    <template v-else>
      <div v-if="planItems.length > 0" data-testid="session-plan-dock" class="bg-base-100 sticky top-0 z-30 mt-4 pb-2 md:mx-10">
        <ChatPlanCard :items="planItems" class="shadow-md" />
      </div>

      <div data-testid="session-history" class="flex flex-col md:mx-10">
        <ChatMessage :messages="messages" />
      </div>

      <p v-if="messages.length === 0" class="text-base-content/70 text-sm">{{ t('sessions.noMessages') }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ApiSessionDto } from '@/api';
import { getSessionsByUuid, getSessionsByUuidMessages } from '@/api';
import { apiErrorCode } from '@/api-client/error';
import ChatMessage from '@/components/Chat/ChatMessage.vue';
import ArrowLeftIcon from '@/components/svg/ArrowLeftIcon.vue';
import ChatPlanCard from '@/components/Chat/ChatPlanCard.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import { planItemsFrom } from '@/config/sessions';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
const alertStore = useAlertStore();
const apiError = useApiError();

const session = ref<ApiSessionDto | null>(null);
const messages = ref<ChatHistoryEntry[]>([]);
const loading = ref(true);
const notFound = ref(false);

const uuid = computed(() => String(route.params.uuid ?? ''));
const planItems = computed(() => planItemsFrom(session.value?.plan_items));

const meta = computed(() => {
  const parts = [`${t('sessions.sessionId')}: ${uuid.value}`];
  if (session.value) {
    parts.push(`${t('sessions.created')} ${formatDateTime(session.value.created_at)}`);
    parts.push(`${t('sessions.updated')} ${formatDateTime(session.value.updated_at)}`);
  }
  return parts.join(' · ');
});

async function load() {
  loading.value = true;
  notFound.value = false;

  const [sessionResult, messagesResult] = await Promise.all([getSessionsByUuid({ path: { uuid: uuid.value } }), getSessionsByUuidMessages({ path: { uuid: uuid.value } })]);
  loading.value = false;

  if (sessionResult.error || !sessionResult.data) {
    session.value = null;
    messages.value = [];

    if (apiErrorCode(sessionResult.error) === 'NOT_FOUND') {
      notFound.value = true;
      return;
    }

    alertStore.addItem({ level: 'error', message: apiError(sessionResult.error, 'sessions.loadError') });
    return;
  }

  session.value = sessionResult.data;

  if (messagesResult.error || !messagesResult.data) {
    messages.value = [];
    alertStore.addItem({ level: 'error', message: apiError(messagesResult.error, 'sessions.loadError') });
    return;
  }

  messages.value = messagesResult.data as unknown as ChatHistoryEntry[];
}

onMounted(load);
</script>
