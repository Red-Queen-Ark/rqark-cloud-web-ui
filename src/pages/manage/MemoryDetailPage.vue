<template>
  <div class="space-y-4">
    <DataToolbar>
      <RouterLink id="memory-detail-back-btn" class="btn btn-ghost btn-sm" :to="{ name: 'memory', params: { lang: route.params.lang } }">
        <ArrowLeftIcon class="h-4 w-4" />
        {{ t('memory.back') }}
      </RouterLink>

      <div class="min-w-0">
        <p class="truncate text-sm font-semibold">{{ agent?.name || t('memory.agentId') }}</p>
        <p class="text-base-content/60 truncate text-xs">{{ meta }}</p>
      </div>
    </DataToolbar>

    <div v-if="loading" data-testid="memory-detail-loading" class="bg-base-200/60 border-base-300 rounded-box border p-4" :aria-label="t('memory.detailLoading')">
      <div class="space-y-3">
        <div class="skeleton h-24 w-full"></div>
        <div class="skeleton h-24 w-3/4"></div>
      </div>
    </div>

    <div v-else-if="notFound" class="bg-base-200/60 border-base-300 rounded-box border">
      <div class="flex flex-col items-center justify-center px-6 py-20 text-center">
        <img src="/logo.svg" alt="" class="mb-4 h-24 w-24 opacity-50" />
        <p class="mb-1 text-xl font-bold">{{ t('memory.detailNotFound') }}</p>
        <p class="text-base-content/70 mb-4 max-w-sm text-sm">{{ t('memory.detailNotFoundDesc') }}</p>
        <p class="text-base-content/60 font-mono text-xs">{{ t('memory.agentId') }}: {{ uuid }}</p>
      </div>
    </div>

    <template v-else>
      <p v-if="memories.length === 0" class="bg-base-200/60 border-base-300 rounded-box border px-6 py-16 text-center">
        <span class="mb-1 block text-base font-semibold">{{ t('memory.noMemory') }}</span>
        <span class="text-base-content/70 text-sm">{{ t('memory.noMemoryDesc') }}</span>
      </p>

      <div v-else data-testid="memory-cards" class="space-y-3">
        <article v-for="card in cards" :key="card.id" :data-testid="`memory-card-${card.id}`" class="bg-base-200/60 border-base-300 rounded-box border p-4">
          <header class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <span class="text-base-content/70 font-mono" data-testid="memory-card-occurred-at">{{ formatDateTime(card.row.occurred_at) }}</span>
            <span class="text-base-content/40" aria-hidden="true">|</span>
            <span class="text-base-content/70">{{ t('memory.hits', { count: card.row.hits ?? 0 }) }}</span>

            <span v-if="card.kind" class="badge badge-xs" :class="card.kind.badgeClass" :data-testid="`memory-card-kind-${card.id}`">{{ t(card.kind.labelKey) }}</span>

            <div class="ml-auto flex items-center gap-2">
              <label class="flex cursor-pointer items-center gap-1" :class="busy.has(card.id) ? 'opacity-60' : ''">
                <span class="text-base-content/70">{{ t('memory.pinned') }}</span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary toggle-xs"
                  :data-testid="`memory-card-pin-${card.id}`"
                  :checked="card.row.pinned === true"
                  :disabled="busy.has(card.id)"
                  :aria-label="t('memory.pinned')"
                  @change="togglePinned(card.row, $event)"
                />
              </label>

              <button class="btn btn-ghost btn-xs text-error" :data-testid="`memory-card-delete-${card.id}`" @click="deleteTarget = card.row">
                {{ t('memory.delete') }}
              </button>
            </div>
          </header>

          <div class="mb-2 flex flex-wrap gap-1" data-testid="memory-card-keywords">
            <span v-for="keyword in card.row.keywords ?? []" :key="keyword" class="badge badge-ghost badge-sm">{{ keyword }}</span>
            <span v-if="(card.row.keywords ?? []).length === 0" class="text-base-content/40 text-xs">{{ t('memory.noKeywords') }}</span>
          </div>

          <p class="text-sm break-words whitespace-pre-wrap" data-testid="memory-card-content">{{ card.row.content }}</p>

          <div class="border-base-300 mt-3 border-t pt-2">
            <button class="btn btn-ghost btn-xs gap-1" :data-testid="`memory-card-toggle-${card.id}`" :aria-expanded="expanded.has(card.id)" @click="toggle(card.row)">
              <ChevronDownIcon class="h-3 w-3 transition-transform" :class="expanded.has(card.id) ? 'rotate-180' : ''" />
              {{ expanded.has(card.id) ? t('memory.hideSourceMessage') : t('memory.showSourceMessage') }}
            </button>

            <div v-if="expanded.has(card.id)" class="mt-2" :data-testid="`memory-card-source-${card.id}`">
              <p v-if="details.get(card.id)?.loading" class="text-base-content/60 text-xs">{{ t('memory.detailLoading') }}</p>
              <p v-else-if="details.get(card.id)?.failed" class="text-error text-xs">{{ t('memory.sourceMessageUnavailable') }}</p>
              <p v-else-if="!hasSourceMessage(card.id)" class="text-base-content/50 text-xs">{{ t('memory.sourceMessageEmpty') }}</p>
              <pre v-else class="bg-base-300/50 scrollbar-thin max-h-64 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">{{ sourceMessageText(card.id) }}</pre>
            </div>
          </div>
        </article>

        <div class="flex items-center justify-center pt-2">
          <span v-if="!nextCursor" class="text-base-content/50 text-xs">{{ t('memory.loadedAll') }}</span>
          <button v-else class="btn btn-ghost btn-sm" data-testid="memory-load-more" :disabled="loadingMore" @click="loadMore">
            <span v-if="loadingMore" class="loading loading-spinner loading-xs"></span>
            {{ t('memory.loadMore') }}
          </button>
        </div>
      </div>
    </template>

    <FormModal
      v-if="deleteTarget"
      :title="t('memory.deleteTitle')"
      :description="t('memory.deleteConfirm')"
      confirm-class="btn-error"
      :confirm-label="t('memory.delete')"
      :cancel-label="t('memory.cancel')"
      :saving="deleting"
      @cancel="deleteTarget = null"
      @confirm="removeMemory"
    >
      <p class="text-sm break-words" data-testid="memory-delete-content">{{ deleteTarget.content }}</p>
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="text-base-content/60 font-mono">{{ formatDateTime(deleteTarget.occurred_at) }}</span>
        <span class="text-base-content/60">{{ t('memory.deleteIncludesRow') }}</span>
      </div>
    </FormModal>
  </div>
</template>

<script setup lang="ts">
import type { ApiAgentDto, ApiMemoryDto } from '@/api';
import { deleteMemoryByUuid, getAgentsByUuid, getMemory, getMemoryByUuid, patchMemoryByUuid } from '@/api';
import { apiErrorCode } from '@/api-client/error';
import ArrowLeftIcon from '@/components/svg/ArrowLeftIcon.vue';
import ChevronDownIcon from '@/components/svg/ChevronDownIcon.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import FormModal from '@/components/FormModal.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const PAGE_SIZE = 100;

interface DetailState {
  loading: boolean;
  failed: boolean;
  source?: Record<string, unknown>;
}

const { t } = useI18n();
const route = useRoute();
const alertStore = useAlertStore();
const apiError = useApiError();

const agent = ref<ApiAgentDto | null>(null);
const memories = ref<ApiMemoryDto[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const notFound = ref(false);
const nextCursor = ref('');
const deleteTarget = ref<ApiMemoryDto | null>(null);
const deleting = ref(false);

const expanded = reactive(new Set<string>());
const busy = reactive(new Set<string>());
const details = reactive(new Map<string, DetailState>());

const uuid = computed(() => String(route.params.uuid ?? ''));

const KIND_STYLES: Record<string, { labelKey: string; badgeClass: string }> = {
  fact: { labelKey: 'memory.kindFact', badgeClass: 'badge-secondary' },
  event: { labelKey: 'memory.kindEvent', badgeClass: 'badge-ghost' },
};

const cards = computed(() =>
  memories.value.map((row) => ({
    id: row.id ?? '',
    row,
    kind: row.kind ? KIND_STYLES[row.kind] : undefined,
  })),
);

const meta = computed(() => {
  const count = memories.value.length === 1 ? t('memory.memoryCountOne') : t('memory.memoryCount', { count: memories.value.length });
  const parts = [`${t('memory.agentId')}: ${uuid.value}`, count];
  if (agent.value) {
    parts.push(`${t('memory.created')} ${formatDateTime(agent.value.created_at)}`);
  }
  return parts.join(' · ');
});

function hasSourceMessage(id: string): boolean {
  const source = details.get(id)?.source;
  return source !== undefined && source !== null;
}

function sourceMessageText(id: string): string {
  return JSON.stringify(details.get(id)?.source ?? null, null, 2);
}

async function toggle(row: ApiMemoryDto) {
  const id = row.id ?? '';

  if (expanded.has(id)) {
    expanded.delete(id);
    return;
  }
  expanded.add(id);

  if (details.has(id)) {
    return;
  }

  const state: DetailState = reactive({ loading: true, failed: false });
  details.set(id, state);

  const result = await getMemoryByUuid({ path: { uuid: id } });
  state.loading = false;

  if (result.error || !result.data) {
    state.failed = true;
    return;
  }
  state.source = result.data.source_message;
}

async function loadPage(cursor: string) {
  return getMemory({ query: { agent_id: uuid.value, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) } });
}

async function load() {
  loading.value = true;
  notFound.value = false;

  const [agentResult, memoryResult] = await Promise.all([getAgentsByUuid({ path: { uuid: uuid.value } }), loadPage('')]);
  loading.value = false;

  if (agentResult.error || !agentResult.data) {
    agent.value = null;
    memories.value = [];
    nextCursor.value = '';

    if (apiErrorCode(agentResult.error) === 'NOT_FOUND') {
      notFound.value = true;
      return;
    }

    alertStore.addItem({ level: 'error', message: apiError(agentResult.error, 'memory.loadError') });
    return;
  }

  agent.value = agentResult.data;

  if (memoryResult.error || !memoryResult.data) {
    memories.value = [];
    nextCursor.value = '';
    alertStore.addItem({ level: 'error', message: apiError(memoryResult.error, 'memory.logError') });
    return;
  }

  memories.value = memoryResult.data.items ?? [];
  nextCursor.value = memoryResult.data.next_cursor ?? '';
}

async function loadMore() {
  loadingMore.value = true;
  const result = await loadPage(nextCursor.value);
  loadingMore.value = false;

  if (result.error || !result.data) {
    alertStore.addItem({ level: 'error', message: apiError(result.error, 'memory.logError') });
    return;
  }

  memories.value = [...memories.value, ...(result.data.items ?? [])];
  nextCursor.value = result.data.next_cursor ?? '';
}

async function togglePinned(row: ApiMemoryDto, event: Event) {
  const id = row.id ?? '';
  const input = event.target as HTMLInputElement;
  if (!id || busy.has(id)) {
    return;
  }

  const wanted = row.pinned !== true;
  busy.add(id);
  const { data, error } = await patchMemoryByUuid({ path: { uuid: id }, body: { pinned: wanted } });
  busy.delete(id);

  if (error || !data) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'memory.pinError') });
    input.checked = row.pinned === true;
    return;
  }

  row.pinned = data.pinned === true;
}

async function removeMemory() {
  const target = deleteTarget.value;
  if (!target?.id) {
    return;
  }

  deleting.value = true;
  const { error } = await deleteMemoryByUuid({ path: { uuid: target.id } });
  deleting.value = false;
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'memory.deleteError') });
    return;
  }

  memories.value = memories.value.filter((row) => row.id !== target.id);
  alertStore.addItem({ level: 'success', message: t('memory.deleted') });
}

onMounted(load);
</script>
