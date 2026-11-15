<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('agents.hint') }}</p>

      <template #actions>
        <button id="agents-page-create-btn" class="btn btn-primary btn-sm" @click="openCreate">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
          {{ t('agents.create') }}
        </button>
      </template>
    </DataToolbar>

    <DataListPanel
      :loading="loading"
      :loading-label="t('agents.loading')"
      :empty="agents.length === 0"
      :empty-title="t('agents.empty')"
      :empty-description="t('agents.emptyDesc')"
      :empty-action-label="t('agents.create')"
      empty-action-id="agents-page-create-first-btn"
      @create="openCreate"
    >
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('agents.name') }}</th>
              <th>{{ t('agents.tools') }}</th>
              <th>{{ t('agents.prompts') }}</th>
              <th>{{ t('agents.subagent') }}</th>
              <th>{{ t('agents.created') }}</th>
              <th>{{ t('agents.updated') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('agents.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="agent in agents" :key="agent.id">
              <td class="font-medium">
                <div class="flex items-center gap-1">
                  <span>{{ agent.name }}</span>
                  <span v-if="agent.is_public" class="badge badge-primary badge-xs">{{ t('agents.public') }}</span>
                </div>
              </td>
              <td class="text-base-content/70">{{ agent.tools?.length ?? 0 }}</td>
              <td class="text-base-content/70">{{ agent.prompts?.length ?? 0 }}</td>
              <td>
                <span v-if="agentHasSubAgent(agent.tools)" class="text-success font-bold">✓</span>
                <span v-else class="text-base-content/40">—</span>
              </td>
              <td class="text-base-content/70">{{ formatDateTime(agent.created_at) }}</td>
              <td class="text-base-content/70">{{ formatDateTime(agent.updated_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <div class="flex items-center justify-end gap-1">
                  <RowActionsMenu v-if="agent.owned">
                    <li>
                      <button @click="openView(agent)">{{ t('agents.view') }}</button>
                    </li>
                    <li>
                      <button @click="openEdit(agent)">{{ t('agents.edit') }}</button>
                    </li>
                    <li>
                      <button class="text-error" @click="deleteTarget = agent">{{ t('agents.delete') }}</button>
                    </li>
                  </RowActionsMenu>
                  <button v-else class="btn btn-ghost btn-xs" @click="openView(agent)">{{ t('agents.view') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DataListPanel>

    <FormModal
      v-if="formModal.open"
      :title="formModal.mode === 'create' ? t('agents.create') : formModal.readonly ? t('agents.view') : t('agents.edit')"
      :confirm-label="t('agents.save')"
      :cancel-label="formModal.readonly ? t('agents.close') : t('agents.cancel')"
      :saving="saving"
      :readonly="formModal.readonly"
      box-class="max-w-5xl"
      @cancel="formModal.open = false"
      @confirm="saveAgent"
    >
      <div class="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3">
        <div class="flex min-w-0 flex-col gap-3">
          <label class="fieldset min-w-0">
            <span class="fieldset-legend">{{ t('agents.name') }}</span>
            <input id="agent-name" v-model="formModal.name" type="text" class="input w-full" :disabled="formModal.readonly" :placeholder="t('agents.namePlaceholder')" @keyup.enter="saveAgent" />
          </label>

          <label class="fieldset grid-rows-[auto_1fr] max-h-64 min-h-0 min-w-0 flex-1">
            <span class="fieldset-legend">{{ t('agents.description') }}</span>
            <textarea id="agent-description" v-model="formModal.description" class="textarea w-full" :disabled="formModal.readonly" :placeholder="t('agents.descriptionPlaceholder')"></textarea>
          </label>
        </div>

        <AgentComponentPicker v-model="formModal.tools" kind="tools" :label="t('agents.tools')" id-prefix="agent-tools" :readonly="formModal.readonly" />
        <AgentComponentPicker v-model="formModal.prompts" kind="prompts" :label="t('agents.prompts')" id-prefix="agent-prompts" :readonly="formModal.readonly" />
      </div>

      <label v-if="isSuperuser && !formModal.readonly" class="fieldset">
        <span class="fieldset-legend">{{ t('agents.public') }}</span>
        <input id="agent-is_public" v-model="formModal.isPublic" type="checkbox" class="toggle" />
      </label>

      <p class="text-base-content/60 text-xs">{{ t('agents.componentsHint') }}</p>
      <p v-if="isSuperuser && !formModal.readonly" class="text-base-content/60 text-xs">{{ t('agents.publicHint') }}</p>
    </FormModal>

    <FormModal
      v-if="deleteTarget"
      :title="t('agents.delete')"
      :description="t('agents.deleteConfirm', { name: deleteTarget.name ?? '' })"
      confirm-class="btn-error"
      :confirm-label="t('agents.delete')"
      :cancel-label="t('agents.cancel')"
      @cancel="deleteTarget = null"
      @confirm="removeAgent"
    />
  </div>
</template>

<script setup lang="ts">
import type { AgentComponentRef } from '@/config/agents';
import { agentHasSubAgent, cleanAgentComponents, toAgentComponentRefs } from '@/config/agents';
import type { ApiAgentDto, ApiCreateAgentRequest, ApiUpdateAgentRequest } from '@/api';
import { deleteAgentsByUuid, getAgents, postAgents, putAgentsByUuid } from '@/api';
import AgentComponentPicker from '@/components/Agent/AgentComponentPicker.vue';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const alertStore = useAlertStore();
const authStore = useAuthStore();
const apiError = useApiError();

const isSuperuser = computed(() => authStore.user?.is_superuser === true);

const agents = ref<ApiAgentDto[]>([]);
const loading = ref(false);
const saving = ref(false);

const formModal = reactive({
  open: false,
  mode: 'create' as 'create' | 'edit',
  uuid: '',
  name: '',
  description: '',
  tools: [] as AgentComponentRef[],
  prompts: [] as AgentComponentRef[],
  isPublic: false,
  wasPublic: false,
  readonly: false,
});
const deleteTarget = ref<ApiAgentDto | null>(null);

async function load() {
  loading.value = true;
  const { data, error } = await getAgents();
  loading.value = false;

  if (error || !data) {
    agents.value = [];
    alertStore.addItem({ level: 'error', message: apiError(error, 'agents.loadError') });
    return;
  }

  agents.value = data;
}

function openCreate() {
  formModal.mode = 'create';
  formModal.uuid = '';
  formModal.name = '';
  formModal.description = '';
  formModal.tools = [];
  formModal.prompts = [];
  formModal.isPublic = false;
  formModal.wasPublic = false;
  formModal.readonly = false;
  formModal.open = true;
}

function openEdit(agent: ApiAgentDto) {
  formModal.mode = 'edit';
  formModal.readonly = false;
  fillForm(agent);
}

function openView(agent: ApiAgentDto) {
  formModal.mode = 'edit';
  formModal.readonly = true;
  fillForm(agent);
}

function fillForm(agent: ApiAgentDto) {
  formModal.uuid = agent.id ?? '';
  formModal.name = agent.name ?? '';
  formModal.description = agent.description ?? '';
  formModal.tools = toAgentComponentRefs(agent.tools);
  formModal.prompts = toAgentComponentRefs(agent.prompts);
  formModal.isPublic = agent.is_public === true;
  formModal.wasPublic = formModal.isPublic;
  formModal.open = true;
}

async function saveAgent() {
  if (!formModal.name) {
    alertStore.addItem({ level: 'warning', message: t('agents.nameRequired') });
    return;
  }

  saving.value = true;
  const body: ApiCreateAgentRequest & ApiUpdateAgentRequest = {
    name: formModal.name,
    description: formModal.description,
    tools: cleanAgentComponents(formModal.tools),
    prompts: cleanAgentComponents(formModal.prompts),
  };
  if (isSuperuser.value && formModal.isPublic !== formModal.wasPublic) {
    body.is_public = formModal.isPublic;
  }
  const { error } = formModal.mode === 'create' ? await postAgents({ body }) : await putAgentsByUuid({ path: { uuid: formModal.uuid }, body });
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'agents.saveError') });
    return;
  }

  formModal.open = false;
  alertStore.addItem({ level: 'success', message: t('agents.saved') });
  void load();
}

async function removeAgent() {
  if (!deleteTarget.value?.id) {
    return;
  }
  const { error } = await deleteAgentsByUuid({ path: { uuid: deleteTarget.value.id } });
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'agents.saveError') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('agents.deleted') });
  void load();
}

onMounted(load);
</script>
