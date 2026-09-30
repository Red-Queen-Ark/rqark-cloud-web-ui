<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('sessions.detailHint') }}</p>

      <template #actions>
        <RouterLink id="session-detail-back-btn" class="btn btn-ghost btn-sm" :to="{ name: 'sessions', params: { lang: route.params.lang } }">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
          {{ t('sessions.back') }}
        </RouterLink>
      </template>
    </DataToolbar>

    <div v-if="loading" data-testid="session-detail-loading" class="bg-base-200/60 border-base-300 rounded-box border p-4" :aria-label="t('sessions.detailLoading')">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="space-y-3">
          <div class="skeleton h-4 w-1/3"></div>
          <div class="skeleton h-20 w-full"></div>
          <div class="skeleton h-20 w-full"></div>
        </div>
        <div class="space-y-3 lg:col-span-2">
          <div class="skeleton h-24 w-full"></div>
          <div class="skeleton h-24 w-3/4"></div>
        </div>
      </div>
    </div>

    <!--
      A session that does not exist and a session of another account are both
      answered 404, and the API does not tell them apart. That is a state of its
      own rather than a failure, so it is rendered here and not raised as an
      alert.
    -->
    <div v-else-if="notFound" class="bg-base-200/60 border-base-300 rounded-box border">
      <div class="flex flex-col items-center justify-center px-6 py-20 text-center">
        <img src="/logo.svg" alt="" class="mb-4 h-24 w-24 opacity-50" />
        <p class="mb-1 text-xl font-bold">{{ t('sessions.detailNotFound') }}</p>
        <p class="text-base-content/70 mb-4 max-w-sm text-sm">{{ t('sessions.detailNotFoundDesc') }}</p>
        <p class="text-base-content/60 font-mono text-xs">{{ t('sessions.sessionId') }}: {{ uuid }}</p>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <aside class="space-y-4 lg:col-span-1">
        <div class="bg-base-200/60 border-base-300 rounded-box border p-4">
          <h2 class="mb-2 text-sm font-bold">{{ t('sessions.metadata') }}</h2>
          <dl class="divide-base-300 divide-y text-sm">
            <div class="flex items-baseline justify-between gap-3 py-2">
              <dt class="text-base-content/70 shrink-0 text-xs">{{ t('sessions.sessionTitle') }}</dt>
              <dd class="min-w-0 truncate text-right">{{ session?.title || t('sessions.untitled') }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 py-2">
              <dt class="text-base-content/70 shrink-0 text-xs">{{ t('sessions.sessionId') }}</dt>
              <dd class="min-w-0 truncate text-right font-mono text-xs">{{ session?.id }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 py-2">
              <dt class="text-base-content/70 shrink-0 text-xs">{{ t('sessions.created') }}</dt>
              <dd>{{ formatDateTime(session?.created_at) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 py-2">
              <dt class="text-base-content/70 shrink-0 text-xs">{{ t('sessions.updated') }}</dt>
              <dd>{{ formatDateTime(session?.updated_at) }}</dd>
            </div>
          </dl>
        </div>

        <div class="bg-base-200/60 border-base-300 rounded-box border p-4">
          <h2 class="mb-2 text-sm font-bold">{{ t('sessions.planTitle') }}</h2>
          <p v-if="planItems.length === 0" class="text-base-content/70 text-xs">{{ t('sessions.planEmpty') }}</p>
          <ul v-else class="space-y-2">
            <li v-for="(item, index) in planItems" :key="item.id ?? index" class="flex items-start gap-2">
              <!--
                An unknown status keeps the raw word: printing one of the four
                known labels would name a state the engine never set.
              -->
              <span class="badge badge-xs shrink-0" :class="planStatusStyle(item.status).badgeClass">{{ planStatusLabel(item.status) }}</span>
              <span class="min-w-0 text-sm break-words">{{ item.content }}</span>
            </li>
          </ul>
        </div>
      </aside>

      <section class="bg-base-200/60 border-base-300 rounded-box border p-4 lg:col-span-2">
        <h2 class="text-sm font-bold">{{ t('sessions.messages') }}</h2>
        <p class="text-base-content/60 mb-3 text-xs">{{ t('sessions.messageOrder') }}</p>

        <p v-if="messages.length === 0" class="text-base-content/70 text-xs">{{ t('sessions.noMessages') }}</p>

        <div v-else class="space-y-3">
          <!--
            `seq` is what the engine orders by, but it is optional in the DTO, so
            the index stands in for a message that arrived without one. The list
            is rendered in the order the API returned it: the messages endpoint
            is already "in the order they were sent", and re-sorting here would
            only invent an order of the UI's own.
          -->
          <template v-for="(message, index) in messages" :key="message.seq ?? index">
            <div v-if="messageRoleStyle(message.role).placement" class="chat" :class="messageRoleStyle(message.role).placement">
              <div class="chat-header text-base-content/70 text-xs">
                {{ messageRoleLabel(message.role) }}
                <time class="ml-1 opacity-70">{{ formatDateTime(message.created_at) }}</time>
              </div>
              <div class="chat-bubble max-w-full">
                <MessageBody :html="messageHtml(message)" :raw="messageRaw(message)" />
              </div>
            </div>

            <!--
              `system` and `tool` are not a side of the conversation, so they get
              a full-width block rather than being pushed onto one.
            -->
            <div v-else class="border-base-300 rounded-box border p-3">
              <p class="text-base-content/70 mb-1 text-xs">
                {{ messageRoleLabel(message.role) }}
                <time class="ml-1 opacity-70">{{ formatDateTime(message.created_at) }}</time>
              </p>
              <MessageBody :html="messageHtml(message)" :raw="messageRaw(message)" />
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiSessionDto, ApiSessionMessageDto } from '@/api';
import { getSessionsByUuid, getSessionsByUuidMessages } from '@/api';
import { apiErrorCode } from '@/api-client/error';
import DataToolbar from '@/components/DataToolbar.vue';
import MessageBody from '@/components/Session/MessageBody.vue';
import { messageRoleStyle, planStatusStyle } from '@/config/sessions';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { renderMarkdown } from '@/utils/markdown';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
const alertStore = useAlertStore();
const apiError = useApiError();

const session = ref<ApiSessionDto | null>(null);
const messages = ref<ApiSessionMessageDto[]>([]);
const loading = ref(true);
const notFound = ref(false);

const uuid = computed(() => String(route.params.uuid ?? ''));
const planItems = computed(() => session.value?.plan_items ?? []);

function planStatusLabel(status?: string): string {
  const { labelKey } = planStatusStyle(status);
  return labelKey ? t(labelKey) : (status ?? '');
}

function messageRoleLabel(role?: string): string {
  const { labelKey } = messageRoleStyle(role);
  return labelKey ? t(labelKey) : role || '—';
}

/**
 * The payload as markdown, or null when it is not plain text.
 *
 * `ApiSessionMessageDto.data` is an open `Record<string, unknown>`: the backend
 * stores the engine's message opaquely and validates nothing about it. A string
 * `content` is the one shape every message the engine writes shares; anything
 * else is shown verbatim rather than guessed at.
 */
function messageHtml(message: ApiSessionMessageDto): string | null {
  const content = message.data?.content;
  return typeof content === 'string' ? renderMarkdown(content) : null;
}

function messageRaw(message: ApiSessionMessageDto): string {
  return JSON.stringify(message.data ?? null, null, 2);
}

async function load() {
  loading.value = true;
  notFound.value = false;

  // Two endpoints by design: the session endpoint answers without its messages,
  // and the messages endpoint answers with nothing else. Neither is optional, and
  // a deep link has no list page to carry the session down from.
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

  messages.value = messagesResult.data;
}

onMounted(load);
</script>
