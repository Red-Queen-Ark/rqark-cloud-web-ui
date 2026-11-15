<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('apiKeys.hint') }}</p>

      <template #actions>
        <button id="api-keys-page-create-btn" class="btn btn-primary btn-sm" @click="openCreate">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
          {{ t('apiKeys.create') }}
        </button>
      </template>
    </DataToolbar>

    <DataListPanel
      :loading="loading"
      :loading-label="t('apiKeys.loading')"
      :empty="keys.length === 0"
      :empty-title="t('apiKeys.empty')"
      :empty-description="t('apiKeys.emptyDesc')"
      :empty-action-label="t('apiKeys.create')"
      empty-action-id="api-keys-page-create-first-btn"
      :total="total"
      :limit="limit"
      :offset="offset"
      :page-info="t('apiKeys.pageInfo', { from: offset + 1, to: Math.min(offset + limit, total), total })"
      :previous-label="t('apiKeys.previous')"
      :next-label="t('apiKeys.next')"
      @create="openCreate"
      @prev="prevPage"
      @next="nextPage"
    >
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('apiKeys.name') }}</th>
              <th>{{ t('apiKeys.trackingId') }}</th>
              <th>{{ t('apiKeys.key') }}</th>
              <th>{{ t('apiKeys.created') }}</th>
              <th>{{ t('apiKeys.lastUsed') }}</th>
              <th>{{ t('apiKeys.expiresAt') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('apiKeys.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="key in keys" :key="key.id">
              <td>
                <div class="flex flex-wrap items-center gap-1">
                  <span class="font-medium">{{ key.name || '—' }}</span>
                  <span v-if="statusOf(key) === 'expired'" class="badge badge-error badge-xs">{{ t('apiKeys.statusExpired') }}</span>
                  <span v-else-if="statusOf(key) === 'disabled'" class="badge badge-warning badge-xs">{{ t('apiKeys.statusDisabled') }}</span>
                </div>
              </td>
              <td>
                <span class="font-mono text-xs">{{ key.id }}</span>
              </td>
              <td>
                <span class="font-mono text-xs">{{ key.key_prefix }}…</span>
              </td>
              <td class="text-base-content/70">{{ formatDateTime(key.created_at) }}</td>
              <td class="text-base-content/70">{{ formatDateTime(key.last_used_at) }}</td>
              <td :class="statusOf(key) === 'expired' ? 'text-error' : 'text-base-content/70'">{{ expiryOf(key) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <div class="flex items-center justify-end gap-1">
                  <RowActionsMenu>
                    <li>
                      <button @click="openEdit(key)">{{ t('apiKeys.edit') }}</button>
                    </li>
                    <li>
                      <button class="text-error" @click="deleteTarget = key">{{ t('apiKeys.delete') }}</button>
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
      :title="formMode === 'create' ? t('apiKeys.create') : t('apiKeys.edit')"
      :description="formMode === 'create' ? t('apiKeys.createHint') : undefined"
      :confirm-label="formMode === 'create' ? t('apiKeys.create') : t('apiKeys.save')"
      :cancel-label="t('apiKeys.cancel')"
      :saving="saving"
      @cancel="formOpen = false"
      @confirm="saveForm"
    >
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('apiKeys.name') }}</span>
        <input id="api-key-form-name" v-model="form.name" type="text" class="input w-full" :placeholder="t('apiKeys.namePlaceholder')" @keyup.enter="saveForm" />
      </label>

      <label class="fieldset">
        <span class="fieldset-legend">{{ t('apiKeys.expiresAt') }}</span>
        <input id="api-key-form-expires-at" v-model="form.expiresAt" type="datetime-local" class="input w-full" />
        <span class="text-base-content/60 text-xs" :class="{ 'text-error': expiryIsPast }">{{ expiryHint }}</span>
      </label>

      <template v-if="formMode === 'edit'">
        <label class="flex cursor-pointer items-center gap-2">
          <input v-model="form.isActive" type="checkbox" class="checkbox checkbox-sm" :disabled="renewOnly" />
          <span>{{ t('apiKeys.active') }}</span>
        </label>
        <p class="text-base-content/60 text-xs">{{ renewOnly ? t('apiKeys.renewHint') : t('apiKeys.activeHint') }}</p>
      </template>
    </FormModal>

    <FormModal v-if="createdKey" :title="t('apiKeys.keyOnceTitle')" :description="t('apiKeys.keyOnceHint')" :confirm-label="t('apiKeys.close')" :cancel-label="t('apiKeys.cancel')" @cancel="createdKey = ''" @confirm="createdKey = ''">
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('apiKeys.key') }}</span>
        <div class="join w-full">
          <input id="api-key-created-value" :value="createdKey" readonly class="input join-item w-full font-mono text-xs" />
          <button id="api-key-created-copy-btn" class="btn join-item" @click="copyCreatedKey">{{ t('apiKeys.copy') }}</button>
        </div>
      </label>
    </FormModal>

    <FormModal
      v-if="deleteTarget"
      :title="t('apiKeys.delete')"
      :description="t('apiKeys.deleteConfirm', { name: deleteTarget.name || deleteTarget.key_prefix || '' })"
      confirm-class="btn-error"
      :confirm-label="t('apiKeys.delete')"
      :cancel-label="t('apiKeys.cancel')"
      @cancel="deleteTarget = null"
      @confirm="removeKey"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiApiKeyDto, ApiCreateApiKeyRequest, ApiUpdateApiKeyRequest } from '@/api';
import { deleteApiKeysByUuid, getApiKeys, patchApiKeysByUuid, postApiKeys } from '@/api';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();

const keys = ref<ApiApiKeyDto[]>([]);
const total = ref(0);
const limit = ref(10);
const offset = ref(0);
const loading = ref(false);
const saving = ref(false);

const formOpen = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const form = reactive({ name: '', expiresAt: '', isActive: true });
const editing = ref<ApiApiKeyDto | null>(null);
const originalExpiry = ref('');

const createdKey = ref('');
const deleteTarget = ref<ApiApiKeyDto | null>(null);

function toLocalInput(value?: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

const expiryIsPast = computed(() => {
  const iso = toIso(form.expiresAt);
  return iso !== undefined && new Date(iso).getTime() <= Date.now();
});

const expiryHint = computed(() => {
  if (!form.expiresAt) {
    return t('apiKeys.expiresAtNever');
  }
  return expiryIsPast.value ? t('apiKeys.expiresAtPast') : t('apiKeys.expiresAtHelp');
});

const renewOnly = computed(() => formMode.value === 'edit' && editing.value?.revoked_message === 'expired');

function statusOf(key: ApiApiKeyDto): 'active' | 'disabled' | 'expired' {
  if (key.revoked_message === 'expired') {
    return 'expired';
  }
  return key.is_active === false ? 'disabled' : 'active';
}

function expiryOf(key: ApiApiKeyDto): string {
  return key.expires_at ? formatDateTime(key.expires_at) : t('apiKeys.expiresAtNone');
}

async function load() {
  loading.value = true;
  const { data, error } = await getApiKeys({ query: { limit: limit.value, offset: offset.value } });
  loading.value = false;

  if (error || !data) {
    keys.value = [];
    total.value = 0;
    alertStore.addItem({ level: 'error', message: apiError(error, 'apiKeys.loadError') });
    return;
  }

  keys.value = data.items ?? [];
  total.value = data.total ?? keys.value.length;
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  void load();
}

function nextPage() {
  offset.value += limit.value;
  void load();
}

function openCreate() {
  formMode.value = 'create';
  editing.value = null;
  originalExpiry.value = '';
  Object.assign(form, { name: '', expiresAt: '', isActive: true });
  formOpen.value = true;
}

function openEdit(key: ApiApiKeyDto) {
  formMode.value = 'edit';
  editing.value = key;
  originalExpiry.value = toLocalInput(key.expires_at);
  Object.assign(form, {
    name: key.name ?? '',
    expiresAt: originalExpiry.value,
    isActive: key.is_active !== false,
  });
  formOpen.value = true;
}

async function saveForm() {
  const name = form.name.trim();
  if (!name) {
    alertStore.addItem({ level: 'warning', message: t('apiKeys.nameRequired') });
    return;
  }
  if (expiryIsPast.value) {
    alertStore.addItem({ level: 'warning', message: t('apiKeys.expiresAtPast') });
    return;
  }

  saving.value = true;
  if (formMode.value === 'create') {
    const body: ApiCreateApiKeyRequest = { name };
    const expiresAt = toIso(form.expiresAt);
    if (expiresAt) {
      body.expires_at = expiresAt;
    }

    const { data, error } = await postApiKeys({ body });
    saving.value = false;

    if (error || !data) {
      alertStore.addItem({ level: 'error', message: apiError(error, 'apiKeys.saveError') });
      return;
    }

    formOpen.value = false;
    createdKey.value = data.key ?? '';
    alertStore.addItem({ level: 'success', message: t('apiKeys.createdToast') });
    void load();
    return;
  }

  const body: ApiUpdateApiKeyRequest = {};
  if (name !== (editing.value?.name ?? '')) {
    body.name = name;
  }
  const expiresAt = toIso(form.expiresAt);
  if (form.expiresAt !== originalExpiry.value) {
    (body as { expires_at?: string | null }).expires_at = expiresAt ?? null;
  }
  if (!renewOnly.value && form.isActive !== (editing.value?.is_active !== false)) {
    body.is_active = form.isActive;
  }

  if (Object.keys(body).length === 0) {
    formOpen.value = false;
    saving.value = false;
    return;
  }

  const { error } = await patchApiKeysByUuid({ path: { uuid: editing.value?.id ?? '' }, body });
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'apiKeys.saveError') });
    return;
  }

  formOpen.value = false;
  alertStore.addItem({ level: 'success', message: t('apiKeys.saved') });
  void load();
}

async function removeKey() {
  if (!deleteTarget.value?.id) {
    return;
  }
  const { error } = await deleteApiKeysByUuid({ path: { uuid: deleteTarget.value.id } });
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'apiKeys.saveError') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('apiKeys.deleted') });
  void load();
}

async function copyCreatedKey() {
  try {
    await navigator.clipboard.writeText(createdKey.value);
    alertStore.addItem({ level: 'success', message: t('apiKeys.copied') });
  } catch {
    alertStore.addItem({ level: 'warning', message: t('apiKeys.copyFailed') });
  }
}

onMounted(load);
</script>
