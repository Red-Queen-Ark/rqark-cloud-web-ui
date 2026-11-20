<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('providers.hint') }}</p>

      <template #actions>
        <button id="providers-page-create-btn" class="btn btn-primary btn-sm" @click="openCreate">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
          {{ t('providers.create') }}
        </button>
      </template>
    </DataToolbar>

    <DataListPanel
      :loading="loading"
      :loading-label="t('providers.loading')"
      :empty="providers.length === 0"
      :empty-title="t('providers.empty')"
      :empty-description="t('providers.emptyDesc')"
      :empty-action-label="t('providers.create')"
      empty-action-id="providers-page-create-first-btn"
      @create="openCreate"
    >
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('providers.field.name') }}</th>
              <th>{{ t('providers.field.model_name') }}</th>
              <th>{{ t('providers.field.api_base') }}</th>
              <th>{{ t('providers.field.priority') }}</th>
              <th>{{ t('providers.created') }}</th>
              <th>{{ t('providers.updated') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('providers.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="provider in providers" :key="provider.id">
              <td class="font-medium">
                <div class="flex items-center gap-1">
                  <span>{{ providerDisplayName(provider) }}</span>
                  <span v-if="provider.is_public" class="badge badge-primary badge-xs">{{ t('providers.public') }}</span>
                </div>
              </td>
              <td class="text-base-content/70">{{ provider.model_name || '—' }}</td>
              <td class="text-base-content/70">{{ provider.api_base || '—' }}</td>
              <td class="text-base-content/70">{{ provider.priority ?? '—' }}</td>
              <td class="text-base-content/70">{{ formatDateTime(provider.created_at) }}</td>
              <td class="text-base-content/70">{{ formatDateTime(provider.updated_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button class="btn btn-ghost btn-xs" :disabled="rowIndex(provider) <= 0 || reordering" :aria-label="t('providers.moveUp')" @click="moveProvider(provider, -1)">
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M5 15l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
                    </svg>
                  </button>
                  <button class="btn btn-ghost btn-xs" :disabled="rowIndex(provider) === -1 || rowIndex(provider) === providers.length - 1 || reordering" :aria-label="t('providers.moveDown')" @click="moveProvider(provider, 1)">
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
                    </svg>
                  </button>
                  <template v-if="provider.owned">
                    <RowActionsMenu>
                      <li>
                        <button @click="openEdit(provider)">{{ t('providers.edit') }}</button>
                      </li>
                      <li>
                        <button class="text-error" @click="deleteTarget = provider">{{ t('providers.delete') }}</button>
                      </li>
                    </RowActionsMenu>
                  </template>
                  <button v-else class="btn btn-ghost btn-xs" :aria-label="t('providers.setOrder')" @click="openOrder(provider)">{{ t('providers.setOrder') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DataListPanel>

    <FormModal
      v-if="formModal.open"
      :title="formModal.mode === 'create' ? t('providers.create') : t('providers.edit')"
      :confirm-label="t('providers.save')"
      :cancel-label="t('providers.cancel')"
      :saving="saving"
      box-class="max-w-3xl"
      @cancel="formModal.open = false"
      @confirm="saveProvider"
    >
      <div class="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        <ProviderField v-for="field in providerFields(false, isSuperuser, creating)" :key="field.key" v-model="form[field.key]" :field="field" :label="t(`providers.field.${field.key}`)" :hint="fieldHint(field)" @submit="saveProvider" />
      </div>

      <p v-if="isSuperuser" class="text-base-content/60 text-xs">{{ t('providers.publicHint') }}</p>

      <details id="provider-advanced" class="bg-base-200/60 border-base-300 rounded-box group border">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
          {{ t('providers.advanced') }}
          <svg class="h-3 w-3 opacity-50 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
        </summary>

        <div class="border-base-300 border-t px-4 py-3">
          <div class="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
            <ProviderField
              v-for="field in providerFields(true, isSuperuser, creating)"
              :key="field.key"
              v-model="form[field.key]"
              :field="field"
              :label="t(`providers.field.${field.key}`)"
              :hint="fieldHint(field)"
              :placeholder="fieldPlaceholder(field)"
              @submit="saveProvider"
            />
          </div>
        </div>
      </details>
    </FormModal>

    <FormModal
      v-if="orderTarget"
      :title="t('providers.setOrder')"
      :description="t('providers.setOrderHint', { name: providerDisplayName(orderTarget) })"
      :confirm-label="t('providers.save')"
      :cancel-label="t('providers.cancel')"
      :saving="saving"
      @cancel="orderTarget = null"
      @confirm="saveOrder"
    >
      <div class="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        <ProviderField v-for="field in orderFields" :key="field.key" v-model="orderForm[field.key]" :field="field" :label="t(`providers.field.${field.key}`)" @submit="saveOrder" />
      </div>
    </FormModal>

    <FormModal
      v-if="deleteTarget"
      :title="t('providers.delete')"
      :description="t('providers.deleteConfirm', { name: providerDisplayName(deleteTarget) })"
      confirm-class="btn-error"
      :confirm-label="t('providers.delete')"
      :cancel-label="t('providers.cancel')"
      @cancel="deleteTarget = null"
      @confirm="removeProvider"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiProviderDto } from '@/api';
import { deleteProvidersByUuid, getProviders, postProviders, putProvidersByUuid, putProvidersByUuidPriority } from '@/api';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import ProviderField from '@/components/Provider/ProviderField.vue';
import { useApiError } from '@/composables/useApiError';
import type { ProviderFieldSpec, ProviderFormValues, ProviderPriorityWrite } from '@/config/providers';
import {
  PROVIDER_FIELDS,
  PROVIDER_HEADERS_EXAMPLE,
  firstMissingRequiredField,
  invalidProviderHeaderVariable,
  providerHeaderVariableList,
  parseProviderHeaders,
  providerDisplayName,
  providerField,
  providerFields,
  providerPriority,
  providerPriorityWrite,
  providerPriorityWrites,
  sortProvidersByPriority,
  toProviderFormValues,
  toProviderRequestBody,
} from '@/config/providers';
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

const providers = ref<ApiProviderDto[]>([]);
const loading = ref(false);
const saving = ref(false);
const reordering = ref(false);

const form = reactive<ProviderFormValues>(toProviderFormValues());
const formModal = reactive({ open: false, mode: 'create' as 'create' | 'edit', uuid: '' });
const creating = computed(() => formModal.mode === 'create');

function fieldHint(field: ProviderFieldSpec): string {
  if (field.control === 'headers') {
    return t('providers.field.headersHint', { vars: providerHeaderVariableList() });
  }
  return field.writeOnly === true && !creating.value ? t('providers.field.api_keyKeep') : '';
}

function fieldPlaceholder(field: ProviderFieldSpec): string {
  return field.control === 'headers' ? PROVIDER_HEADERS_EXAMPLE : '';
}
const deleteTarget = ref<ApiProviderDto | null>(null);

const orderTarget = ref<ApiProviderDto | null>(null);
const orderForm = reactive<ProviderFormValues>(toProviderFormValues());
const orderFields = [providerField('priority')];

async function load() {
  loading.value = true;
  const { data, error } = await getProviders();
  loading.value = false;

  if (error || !data) {
    providers.value = [];
    alertStore.addItem({ level: 'error', message: apiError(error, 'providers.loadError') });
    return;
  }

  providers.value = sortProvidersByPriority(data);
}

function rowIndex(provider: ApiProviderDto): number {
  return providers.value.findIndex((candidate) => candidate.id === provider.id);
}

function openCreate() {
  Object.assign(form, toProviderFormValues());
  formModal.mode = 'create';
  formModal.uuid = '';
  formModal.open = true;
}

function openEdit(provider: ApiProviderDto) {
  Object.assign(form, toProviderFormValues(provider));
  formModal.mode = 'edit';
  formModal.uuid = provider.id ?? '';
  formModal.open = true;
}

async function saveProvider() {
  const missing = firstMissingRequiredField(form, PROVIDER_FIELDS, creating.value);
  if (missing) {
    alertStore.addItem({ level: 'warning', message: t('providers.required', { field: t(`providers.field.${missing.key}`) }) });
    return;
  }

  const headers = parseProviderHeaders(String(form.headers ?? ''));
  if (headers.invalid.length > 0) {
    alertStore.addItem({ level: 'warning', message: t('providers.headersInvalid', { line: headers.invalid[0] }) });
    return;
  }

  const badVariable = invalidProviderHeaderVariable(headers.headers);
  if (badVariable) {
    alertStore.addItem({ level: 'warning', message: t('providers.headersUnknownVariable', { header: badVariable.header, placeholder: badVariable.placeholder }) });
    return;
  }

  saving.value = true;
  const body = toProviderRequestBody(form, isSuperuser.value);
  const { error } = formModal.mode === 'create' ? await postProviders({ body }) : await putProvidersByUuid({ path: { uuid: formModal.uuid }, body });
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'providers.saveError') });
    return;
  }

  formModal.open = false;
  alertStore.addItem({ level: 'success', message: t('providers.saved') });
  void load();
}

async function moveProvider(provider: ApiProviderDto, direction: -1 | 1) {
  const writes = providerPriorityWrites(providers.value, rowIndex(provider), direction);

  if (writes.length === 0) {
    return;
  }

  reordering.value = true;

  for (const write of writes) {
    const { error } = await writeProviderPriority(write);

    if (error) {
      reordering.value = false;
      alertStore.addItem({ level: 'error', message: apiError(error, 'providers.saveError') });
      void load();
      return;
    }
  }

  reordering.value = false;
  void load();
}

async function writeProviderPriority(write: ProviderPriorityWrite) {
  return write.owned ? putProvidersByUuid({ path: { uuid: write.id }, body: { priority: write.priority } }) : putProvidersByUuidPriority({ path: { uuid: write.id }, body: { priority: write.priority } });
}

function openOrder(provider: ApiProviderDto) {
  orderTarget.value = provider;
  orderForm.priority = providerPriority(provider);
}

async function saveOrder() {
  if (!orderTarget.value) {
    return;
  }

  const missing = firstMissingRequiredField(orderForm, orderFields);
  if (missing) {
    alertStore.addItem({ level: 'warning', message: t('providers.required', { field: t(`providers.field.${missing.key}`) }) });
    return;
  }

  const write = providerPriorityWrite(orderTarget.value, Number(orderForm.priority));
  if (!write) {
    return;
  }

  saving.value = true;
  const { error } = await writeProviderPriority(write);
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'providers.saveError') });
    void load();
    return;
  }

  orderTarget.value = null;
  alertStore.addItem({ level: 'success', message: t('providers.saved') });
  void load();
}

async function removeProvider() {
  if (!deleteTarget.value?.id) {
    return;
  }
  const { error } = await deleteProvidersByUuid({ path: { uuid: deleteTarget.value.id } });
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'providers.saveError') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('providers.deleted') });
  void load();
}

onMounted(load);
</script>
