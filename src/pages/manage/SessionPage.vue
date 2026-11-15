<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('sessions.hint') }}</p>
    </DataToolbar>

    <DataListPanel :loading="loading" :loading-label="t('sessions.loading')" :empty="sessions.length === 0" :empty-title="t('sessions.empty')" :empty-description="t('sessions.emptyDesc')">
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('sessions.sessionTitle') }}</th>
              <th>{{ t('sessions.source') }}</th>
              <th>{{ t('sessions.planItems') }}</th>
              <th>{{ t('sessions.created') }}</th>
              <th>{{ t('sessions.updated') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('sessions.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="session in sessions" :key="session.id" :data-testid="`session-row-${session.id}`">
              <td class="font-medium">{{ session.title || '—' }}</td>
              <td class="text-base-content/70">{{ session.source || '—' }}</td>
              <td class="text-base-content/70">{{ session.plan_items?.length ?? 0 }}</td>
              <td class="text-base-content/70">{{ formatDateTime(session.created_at) }}</td>
              <td class="text-base-content/70">{{ formatDateTime(session.updated_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <div class="flex items-center justify-end gap-1">
                  <RowActionsMenu>
                    <li>
                      <button @click="openSession(session)">{{ t('sessions.view') }}</button>
                    </li>
                    <li>
                      <button @click="openEdit(session)">{{ t('sessions.edit') }}</button>
                    </li>
                    <li>
                      <button class="text-error" @click="deleteTarget = session">{{ t('sessions.delete') }}</button>
                    </li>
                  </RowActionsMenu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DataListPanel>

    <FormModal v-if="form.open" :title="t('sessions.editTitle')" :confirm-label="t('sessions.save')" :cancel-label="t('sessions.cancel')" :saving="saving" @cancel="form.open = false" @confirm="saveSession">
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('sessions.sessionTitle') }}</span>
        <input id="session-form-title" v-model="form.title" type="text" class="input w-full" :placeholder="t('sessions.titlePlaceholder')" @keyup.enter="saveSession" />
      </label>

      <div class="fieldset">
        <span class="fieldset-legend">{{ t('sessions.source') }}</span>
        <select id="session-form-source" v-model="form.source" class="select w-full">
          <option :value="''">{{ t('sessions.sourceNone') }}</option>
          <option v-for="source in KNOWN_SESSION_SOURCES" :key="source" :value="source">{{ source }}</option>
          <option :value="null">{{ t('sessions.sourceOther') }}</option>
        </select>

        <input
          v-if="form.source === null"
          id="session-form-custom-source"
          v-model="form.customSource"
          type="text"
          class="input w-full"
          :maxlength="SESSION_SOURCE_MAX_LENGTH"
          :placeholder="t('sessions.sourceCustomPlaceholder')"
          @keyup.enter="saveSession"
        />
      </div>
    </FormModal>

    <FormModal
      v-if="deleteTarget"
      :title="t('sessions.deleteTitle')"
      :description="t('sessions.deleteConfirm', { name: deleteTarget.title || t('sessions.untitled') })"
      confirm-class="btn-error"
      :confirm-label="t('sessions.delete')"
      :cancel-label="t('sessions.cancel')"
      :saving="deleting"
      @cancel="deleteTarget = null"
      @confirm="removeSession"
    >
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="badge badge-ghost">{{ deleteTarget.source || t('sessions.sourceNone') }}</span>
        <span class="text-base-content/60">{{ formatDateTime(deleteTarget.updated_at) }}</span>
        <span class="text-base-content/60">{{ t('sessions.deleteIncludesMessages') }}</span>
      </div>
    </FormModal>
  </div>
</template>

<script setup lang="ts">
import type { ApiSessionDto } from '@/api';
import { deleteSessionsByUuid, getSessions, putSessionsByUuid } from '@/api';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import { KNOWN_SESSION_SOURCES, SESSION_SOURCE_MAX_LENGTH, isKnownSessionSource } from '@/config/sessionSources';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const alertStore = useAlertStore();
const apiError = useApiError();

const sessions = ref<ApiSessionDto[]>([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const deleteTarget = ref<ApiSessionDto | null>(null);

const form = reactive({
  open: false,
  uuid: '',
  title: '',
  source: '' as string | null,
  customSource: '',
});

function chosenSource(): string {
  return form.source === null ? form.customSource.trim() : form.source;
}

async function load() {
  loading.value = true;
  const { data, error } = await getSessions();
  loading.value = false;

  if (error || !data) {
    sessions.value = [];
    alertStore.addItem({ level: 'error', message: apiError(error, 'sessions.loadError') });
    return;
  }

  sessions.value = data;
}

function openSession(session: ApiSessionDto) {
  if (!session.id) {
    return;
  }
  void router.push({ name: 'sessionDetail', params: { lang: route.params.lang as string, uuid: session.id } });
}

function openEdit(session: ApiSessionDto) {
  const source = session.source ?? '';
  form.uuid = session.id ?? '';
  form.title = session.title ?? '';
  form.source = source === '' || isKnownSessionSource(source) ? source : null;
  form.customSource = form.source === null ? source : '';
  form.open = true;
}

async function saveSession() {
  const source = chosenSource();
  if (form.source === null && !source) {
    alertStore.addItem({ level: 'warning', message: t('sessions.sourceRequired') });
    return;
  }

  saving.value = true;
  const { error } = await putSessionsByUuid({ path: { uuid: form.uuid }, body: { title: form.title, source } });
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'sessions.saveError') });
    return;
  }

  form.open = false;
  alertStore.addItem({ level: 'success', message: t('sessions.saved') });
  await load();
}

async function removeSession() {
  const target = deleteTarget.value;
  if (!target?.id) {
    return;
  }

  deleting.value = true;
  const { error } = await deleteSessionsByUuid({ path: { uuid: target.id } });
  deleting.value = false;
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'sessions.deleteError') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('sessions.deleted') });
  await load();
}

onMounted(load);
</script>
