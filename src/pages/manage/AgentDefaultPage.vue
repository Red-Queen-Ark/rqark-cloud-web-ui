<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('agentDefaults.hint') }}</p>

      <template #actions>
        <button id="agent-defaults-page-create-btn" class="btn btn-primary btn-sm" @click="openCreate">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
          {{ t('agentDefaults.create') }}
        </button>
      </template>
    </DataToolbar>

    <DataListPanel
      :loading="loading"
      :loading-label="t('agentDefaults.loading')"
      :empty="defaults.length === 0"
      :empty-title="t('agentDefaults.empty')"
      :empty-description="t('agentDefaults.emptyDesc')"
      :empty-action-label="t('agentDefaults.create')"
      empty-action-id="agent-defaults-page-create-first-btn"
      @create="openCreate"
    >
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('agentDefaults.source') }}</th>
              <th>{{ t('agentDefaults.agent') }}</th>
              <th>{{ t('agentDefaults.created') }}</th>
              <th>{{ t('agentDefaults.updated') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('agentDefaults.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in defaults" :key="entry.source">
              <td class="font-medium">{{ entry.source }}</td>
              <td class="text-base-content/70">{{ agentLabel(entry.agent_id) }}</td>
              <td class="text-base-content/70">{{ formatDateTime(entry.created_at) }}</td>
              <td class="text-base-content/70">{{ formatDateTime(entry.updated_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <div class="flex items-center justify-end gap-1">
                  <RowActionsMenu>
                    <li>
                      <button @click="openEdit(entry)">{{ t('agentDefaults.edit') }}</button>
                    </li>
                    <li>
                      <button class="text-error" @click="deleteTarget = entry">{{ t('agentDefaults.delete') }}</button>
                    </li>
                  </RowActionsMenu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DataListPanel>

    <FormModal
      v-if="formOpen"
      :title="formMode === 'create' ? t('agentDefaults.create') : t('agentDefaults.edit')"
      :description="formMode === 'create' ? t('agentDefaults.createHint') : undefined"
      :confirm-label="t('agentDefaults.save')"
      :cancel-label="t('agentDefaults.cancel')"
      :saving="saving"
      @cancel="formOpen = false"
      @confirm="saveForm"
    >
      <div class="fieldset">
        <span class="fieldset-legend">{{ t('agentDefaults.source') }}</span>
        <template v-if="formMode === 'create'">
          <select id="agent-default-source" v-model="form.source" class="select w-full">
            <option v-for="source in KNOWN_SESSION_SOURCES" :key="source" :value="source">{{ source }}</option>
            <option :value="null">{{ t('agentDefaults.sourceOther') }}</option>
          </select>
          <input
            v-if="form.source === null"
            id="agent-default-custom-source"
            v-model="form.customSource"
            type="text"
            class="input w-full"
            :maxlength="SESSION_SOURCE_MAX_LENGTH"
            :placeholder="t('agentDefaults.sourcePlaceholder')"
            @keyup.enter="saveForm"
          />
        </template>
        <template v-else>
          <input id="agent-default-source" :value="form.source" type="text" class="input w-full" disabled />
          <span class="text-base-content/60 text-xs">{{ t('agentDefaults.sourceHint') }}</span>
        </template>
      </div>

      <label class="fieldset">
        <span class="fieldset-legend">{{ t('agentDefaults.agent') }}</span>
        <select id="agent-default-agent" v-model="form.agentId" class="select w-full">
          <option value="" disabled>{{ t('agentDefaults.agentPlaceholder') }}</option>
          <option v-for="option in dialogAgentOptions" :key="option.id" :value="option.id">{{ option.name }}</option>
        </select>
        <span v-if="dialogAgentOptions.length === 0" class="text-base-content/60 text-xs">{{ t('agentDefaults.noAgents') }}</span>
      </label>
    </FormModal>

    <FormModal
      v-if="deleteTarget"
      :title="t('agentDefaults.delete')"
      :description="t('agentDefaults.deleteConfirm', { source: deleteTarget.source ?? '' })"
      confirm-class="btn-error"
      :confirm-label="t('agentDefaults.delete')"
      :cancel-label="t('agentDefaults.cancel')"
      @cancel="deleteTarget = null"
      @confirm="removeDefault"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiAgentDefaultDto, ApiAgentDto } from '@/api';
import { deleteAgentDefaultsBySource, getAgentDefaults, getAgents, putAgentDefaultsBySource } from '@/api';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import { KNOWN_SESSION_SOURCES, SESSION_SOURCE_MAX_LENGTH } from '@/config/sessionSources';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();

const defaults = ref<ApiAgentDefaultDto[]>([]);
const agents = ref<ApiAgentDto[]>([]);
const loading = ref(false);
const saving = ref(false);

const formOpen = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const form = reactive({
  source: KNOWN_SESSION_SOURCES[0] as string | null,
  customSource: '',
  agentId: '',
});
const deleteTarget = ref<ApiAgentDefaultDto | null>(null);

const agentOptions = computed(() => agents.value.flatMap((agent) => (agent.id === undefined || agent.id === '' ? [] : [{ id: agent.id, name: agent.name || agent.id }])));

function agentLabel(id?: string): string {
  if (!id) {
    return '—';
  }
  return agentOptions.value.find((option) => option.id === id)?.name ?? id;
}

const dialogAgentOptions = computed(() => {
  const known = agentOptions.value;
  if (formMode.value === 'edit' && form.agentId && !known.some((option) => option.id === form.agentId)) {
    return [{ id: form.agentId, name: `${form.agentId} (${t('agentDefaults.unknownAgent')})` }, ...known];
  }
  return known;
});

function chosenSource(): string {
  return form.source === null ? form.customSource.trim() : form.source;
}

async function load() {
  loading.value = true;
  const [defaultsResult, agentsResult] = await Promise.all([getAgentDefaults(), getAgents()]);
  loading.value = false;

  if (defaultsResult.error || !defaultsResult.data) {
    defaults.value = [];
    alertStore.addItem({ level: 'error', message: apiError(defaultsResult.error, 'agentDefaults.loadError') });
    return;
  }

  defaults.value = defaultsResult.data;
  agents.value = agentsResult.data ?? [];
}

function openCreate() {
  formMode.value = 'create';
  form.source = KNOWN_SESSION_SOURCES.find((source) => !defaults.value.some((entry) => entry.source === source)) ?? KNOWN_SESSION_SOURCES[0];
  form.customSource = '';
  form.agentId = '';
  formOpen.value = true;
}

function openEdit(entry: ApiAgentDefaultDto) {
  formMode.value = 'edit';
  form.source = entry.source ?? '';
  form.customSource = '';
  form.agentId = entry.agent_id ?? '';
  formOpen.value = true;
}

async function saveForm() {
  const source = chosenSource();
  if (!source) {
    alertStore.addItem({ level: 'warning', message: t('agentDefaults.sourceRequired') });
    return;
  }
  if (!form.agentId) {
    alertStore.addItem({ level: 'warning', message: t('agentDefaults.agentRequired') });
    return;
  }

  saving.value = true;
  const { error } = await putAgentDefaultsBySource({ path: { source }, body: { agent_id: form.agentId } });
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'agentDefaults.saveError') });
    return;
  }

  formOpen.value = false;
  alertStore.addItem({ level: 'success', message: t('agentDefaults.saved') });
  void load();
}

async function removeDefault() {
  if (!deleteTarget.value?.source) {
    return;
  }
  const { error } = await deleteAgentDefaultsBySource({ path: { source: deleteTarget.value.source } });
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'agentDefaults.saveError') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('agentDefaults.deleted') });
  void load();
}

onMounted(load);
</script>
