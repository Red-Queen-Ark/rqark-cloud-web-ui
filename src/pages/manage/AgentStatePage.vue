<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('agentState.hint') }}</p>
      <template #actions>
        <TurnWriteToggle setting="stateUpdate" />
      </template>
    </DataToolbar>

    <DataListPanel :loading="loading" :loading-label="t('agentState.loading')" :empty="agents.length === 0" :empty-title="t('agentState.empty')" :empty-description="t('agentState.emptyDesc')">
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('agentState.agent') }}</th>
              <th>{{ t('agentState.description') }}</th>
              <th>{{ t('agentState.created') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('agentState.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="agent in agents" :key="agent.id" :data-testid="`state-agent-row-${agent.id}`">
              <td class="font-medium">
                <div class="flex items-center gap-1">
                  <span>{{ agent.name }}</span>
                  <span v-if="agent.is_public" class="badge badge-primary badge-xs">{{ t('agents.public') }}</span>
                </div>
              </td>
              <td class="text-base-content/70 max-w-xs truncate">{{ agent.description || '—' }}</td>
              <td class="text-base-content/70">{{ formatDateTime(agent.created_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <button class="btn btn-ghost btn-xs" :data-testid="`state-agent-open-${agent.id}`" @click="open(agent)">
                  {{ t('agentState.view') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DataListPanel>

    <p v-if="!selected" class="bg-base-200/60 border-base-300 rounded-box border px-6 py-16 text-center" data-testid="state-no-selection">
      <span class="mb-1 block text-base font-semibold">{{ t('agentState.pickAgent') }}</span>
      <span class="text-base-content/70 text-sm">{{ t('agentState.pickAgentDesc') }}</span>
    </p>

    <section v-else data-testid="state-board" class="bg-base-200/60 border-base-300 rounded-box border p-4">
      <header class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span class="text-sm font-semibold" data-testid="state-board-agent">{{ selected.name }}</span>
        <span v-if="board?.version !== undefined" class="badge badge-xs" data-testid="state-board-version">{{ t('agentState.version', { version: board.version }) }}</span>
        <span v-if="board?.source" class="text-base-content/70"
          >{{ t('agentState.source') }}: <span class="font-mono" data-testid="state-board-source">{{ board.source }}</span></span
        >
        <span v-if="board?.updated_at" class="text-base-content/70"
          >{{ t('agentState.updatedAt') }}: <span class="font-mono">{{ formatDateTime(board.updated_at) }}</span></span
        >

        <div class="ml-auto flex items-center gap-2">
          <button class="btn btn-ghost btn-xs" :data-testid="`state-edit-${selected.id}`" :disabled="boardLoading" @click="openEditor">{{ t('agentState.edit') }}</button>
          <button v-if="board" class="btn btn-ghost btn-xs text-error" :data-testid="`state-delete-${selected.id}`" @click="deleteTarget = board">{{ t('agentState.delete') }}</button>
        </div>
      </header>

      <p v-if="boardLoading" class="text-base-content/60 text-xs" data-testid="state-board-loading">{{ t('agentState.boardLoading') }}</p>
      <p v-else-if="boardFailed" class="text-error text-xs" data-testid="state-board-error">{{ t('agentState.boardError') }}</p>

      <div v-else-if="!board" data-testid="state-board-empty">
        <p class="mb-1 text-base font-semibold">{{ t('agentState.noState') }}</p>
        <p class="text-base-content/70 text-sm">{{ t('agentState.noStateDesc') }}</p>
      </div>

      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-else class="markdown-body text-sm break-words" data-testid="state-board-content" v-html="boardHtml"></div>
    </section>

    <FormModal
      v-if="editor.open"
      wide
      :title="t('agentState.editTitle')"
      :description="t('agentState.editDescription')"
      :confirm-label="t('agentState.save')"
      :cancel-label="t('agentState.cancel')"
      :saving="saving"
      @cancel="closeEditor"
      @confirm="save"
    >
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('agentState.content') }}</span>
        <textarea v-model="editor.content" data-testid="state-content-input" class="textarea h-64 w-full font-mono text-sm" :placeholder="t('agentState.contentPlaceholder')"></textarea>
        <span class="label" :class="tooLong ? 'text-error' : ''" data-testid="state-char-count">{{ t('agentState.charCount', { count: contentLength, max: CONTENT_MAX_LENGTH }) }}</span>
      </label>
    </FormModal>

    <FormModal
      v-if="deleteTarget"
      :title="t('agentState.deleteTitle')"
      :description="t('agentState.deleteConfirm')"
      confirm-class="btn-error"
      :confirm-label="t('agentState.delete')"
      :cancel-label="t('agentState.cancel')"
      :saving="deleting"
      @cancel="deleteTarget = null"
      @confirm="removeBoard"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiAgentDto, ApiAgentStateDto } from '@/api';
import { deleteMemoryState, getAgents, getMemoryState, putMemoryState } from '@/api';
import { apiErrorCode } from '@/api-client/error';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import TurnWriteToggle from '@/components/TurnWriteToggle.vue';
import FormModal from '@/components/FormModal.vue';
import { useApiError } from '@/composables/useApiError';
import { CONTENT_MAX_LENGTH } from '@/config/limits';
import { AGENT_CLOUD_SOURCE } from '@/config/sessionSources';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { renderMarkdown } from '@/utils/markdown';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();

interface Editor {
  open: boolean;
  content: string;
}

const agents = ref<ApiAgentDto[]>([]);
const loading = ref(true);
const selected = ref<ApiAgentDto | null>(null);
const board = ref<ApiAgentStateDto | null>(null);
const boardLoading = ref(false);
const boardFailed = ref(false);
const saving = ref(false);
const deleting = ref(false);
const deleteTarget = ref<ApiAgentStateDto | null>(null);
const editor = reactive<Editor>({ open: false, content: '' });

const boardHtml = computed(() => renderMarkdown(board.value?.content));
const contentLength = computed(() => [...editor.content].length);
const tooLong = computed(() => contentLength.value > CONTENT_MAX_LENGTH);

async function load() {
  loading.value = true;
  const result = await getAgents();
  loading.value = false;

  if (result.error || !result.data) {
    agents.value = [];
    alertStore.addItem({ level: 'error', message: apiError(result.error, 'agentState.loadError') });
    return;
  }

  agents.value = result.data;
}

async function open(agent: ApiAgentDto) {
  selected.value = agent;
  await loadBoard(agent.id ?? '');
}

async function loadBoard(agentId: string) {
  board.value = null;
  boardFailed.value = false;
  boardLoading.value = true;

  const result = await getMemoryState({ query: { agent_id: agentId } });

  if (selected.value?.id !== agentId) {
    return;
  }
  boardLoading.value = false;

  if (result.error || !result.data) {
    if (apiErrorCode(result.error) !== 'NOT_FOUND') {
      boardFailed.value = true;
      alertStore.addItem({ level: 'error', message: apiError(result.error, 'agentState.boardError') });
    }
    return;
  }

  board.value = result.data;
}

function openEditor() {
  if (!selected.value) {
    return;
  }
  Object.assign(editor, { open: true, content: board.value?.content ?? '' });
}

function closeEditor() {
  editor.open = false;
}

async function save() {
  const agent = selected.value;
  if (!agent?.id) {
    return;
  }
  if (editor.content.trim() === '') {
    alertStore.addItem({ level: 'warning', message: t('agentState.contentRequired') });
    return;
  }
  if (tooLong.value) {
    alertStore.addItem({ level: 'warning', message: t('agentState.contentTooLong', { max: CONTENT_MAX_LENGTH }) });
    return;
  }

  saving.value = true;
  const { data, error } = await putMemoryState({
    body: { agent_id: agent.id, content: editor.content, source: AGENT_CLOUD_SOURCE, ...(board.value?.version !== undefined ? { version: board.value.version } : {}) },
  });
  saving.value = false;

  if (error || !data) {
    if (apiErrorCode(error) === 'STATE_CONFLICT') {
      alertStore.addItem({ level: 'error', message: t('agentState.conflict') });
      editor.open = false;
      await loadBoard(agent.id);
      return;
    }
    alertStore.addItem({ level: 'error', message: apiError(error, 'agentState.saveError') });
    return;
  }

  editor.open = false;
  board.value = data;
  alertStore.addItem({ level: 'success', message: t('agentState.saved') });
}

async function removeBoard() {
  const agent = selected.value;
  deleteTarget.value = null;
  if (!agent?.id) {
    return;
  }

  deleting.value = true;
  const { error } = await deleteMemoryState({ query: { agent_id: agent.id } });
  deleting.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'agentState.deleteError') });
    return;
  }

  board.value = null;
  alertStore.addItem({ level: 'success', message: t('agentState.deleted') });
}

onMounted(load);
</script>
