<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('groups.hint') }}</p>

      <template #actions>
        <button id="groups-page-create-btn" class="btn btn-primary btn-sm" @click="openCreate">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
          {{ t('groups.create') }}
        </button>
      </template>
    </DataToolbar>

    <DataListPanel
      :loading="loading"
      :loading-label="t('groups.loading')"
      :empty="groups.length === 0"
      :empty-title="t('groups.empty')"
      :empty-description="t('groups.emptyDesc')"
      :empty-action-label="t('groups.create')"
      empty-action-id="groups-page-create-first-btn"
      :total="total"
      :limit="limit"
      :offset="offset"
      :page-info="t('groups.pageInfo', { from: offset + 1, to: Math.min(offset + limit, total), total })"
      :previous-label="t('groups.previous')"
      :next-label="t('groups.next')"
      @create="openCreate"
      @prev="prevPage"
      @next="nextPage"
    >
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('groups.name') }}</th>
              <th>{{ t('groups.created') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('groups.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in groups" :key="group.id">
              <td class="font-medium">{{ group.name }}</td>
              <td class="text-base-content/70">{{ formatDateTime(group.created_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <div class="flex items-center justify-end gap-1">
                  <RowActionsMenu>
                    <li>
                      <button @click="openMembers(group)">{{ t('groups.members') }}</button>
                    </li>
                    <li>
                      <button @click="openRename(group)">{{ t('groups.rename') }}</button>
                    </li>
                    <li>
                      <button class="text-error" @click="deleteTarget = group">{{ t('groups.delete') }}</button>
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
      v-if="nameModal.open"
      :title="nameModal.mode === 'create' ? t('groups.create') : t('groups.rename')"
      :confirm-label="t('groups.save')"
      :cancel-label="t('groups.cancel')"
      :saving="saving"
      @cancel="nameModal.open = false"
      @confirm="saveName"
    >
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('groups.name') }}</span>
        <input id="group-name" v-model="nameModal.name" type="text" class="input w-full" :placeholder="t('groups.namePlaceholder')" @keyup.enter="saveName" />
      </label>
    </FormModal>

    <FormModal
      v-if="deleteTarget"
      :title="t('groups.delete')"
      :description="t('groups.deleteConfirm', { name: deleteTarget.name ?? '' })"
      confirm-class="btn-error"
      :confirm-label="t('groups.delete')"
      :cancel-label="t('groups.cancel')"
      @cancel="deleteTarget = null"
      @confirm="removeGroup"
    />

    <FormModal v-if="membersModal.open" :title="t('groups.membersTitle', { name: membersModal.group?.name ?? '' })" wide :confirm-label="t('groups.close')" :cancel-label="t('groups.cancel')" @cancel="closeMembers" @confirm="closeMembers">
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('groups.addMember') }}</span>
        <input id="member-search" v-model="memberQuery" type="text" class="input input-sm w-full" :placeholder="t('groups.addMemberPlaceholder')" @input="searchCandidates" />
      </label>

      <div v-if="candidates.length > 0" class="border-base-300 rounded-box max-h-40 overflow-y-auto border">
        <button v-for="candidate in candidates" :key="candidate.id" class="hover:bg-base-300 flex w-full items-center justify-between px-3 py-2 text-left" @click="addMember(candidate)">
          <span class="min-w-0 truncate">
            <span class="font-medium">{{ candidate.username }}</span>
            <span class="text-base-content/60 ml-2 text-xs">{{ candidate.email }}</span>
          </span>
          <span class="text-primary shrink-0 text-xs">{{ t('groups.add') }}</span>
        </button>
      </div>
      <p v-else-if="memberQuery" class="text-base-content/50 text-xs">{{ t('groups.noCandidates') }}</p>

      <div v-if="membersLoading" class="flex items-center justify-center py-6">
        <span class="loading loading-spinner loading-sm text-primary" :aria-label="t('groups.loading')"></span>
      </div>
      <p v-else-if="members.length === 0" class="text-base-content/50 py-6 text-center text-sm">{{ t('groups.membersEmpty') }}</p>
      <ul v-else class="divide-base-300 divide-y">
        <li v-for="member in members" :key="member.id" class="flex items-center justify-between gap-2 py-2">
          <span class="min-w-0 truncate">
            <span class="font-medium">{{ member.username }}</span>
            <span class="text-base-content/70 ml-2 text-xs">{{ member.display_name || member.email }}</span>
          </span>
          <button class="btn btn-ghost btn-xs text-error shrink-0" @click="removeMember(member)">{{ t('groups.remove') }}</button>
        </li>
      </ul>
    </FormModal>
  </div>
</template>

<script setup lang="ts">
import type { ApiCreateGroupRequest, ApiGroupDto, ApiUpdateGroupRequest, ApiUserDto } from '@/api';
import { deleteGroupsByUuid, deleteGroupsByUuidUsersByUserUuid, getGroups, getGroupsByUuidUsers, getUsers, patchGroupsByUuid, postGroups, putGroupsByUuidUsersByUserUuid } from '@/api';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();

const groups = ref<ApiGroupDto[]>([]);
const total = ref(0);
const limit = ref(10);
const offset = ref(0);
const loading = ref(false);
const saving = ref(false);

const nameModal = reactive({ open: false, mode: 'create' as 'create' | 'rename', uuid: '', name: '' });

const membersModal = reactive({ open: false, group: null as ApiGroupDto | null });
const members = ref<ApiUserDto[]>([]);
const membersLoading = ref(false);
const memberQuery = ref('');
const candidates = ref<ApiUserDto[]>([]);

const deleteTarget = ref<ApiGroupDto | null>(null);

async function load() {
  loading.value = true;
  const { data, error } = await getGroups({ query: { limit: limit.value, offset: offset.value } });
  loading.value = false;

  if (error || !data) {
    groups.value = [];
    total.value = 0;
    alertStore.addItem({ level: 'error', message: apiError(error, 'groups.loadError') });
    return;
  }

  groups.value = data.items ?? [];
  total.value = data.total ?? groups.value.length;
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
  nameModal.mode = 'create';
  nameModal.uuid = '';
  nameModal.name = '';
  nameModal.open = true;
}

function openRename(group: ApiGroupDto) {
  nameModal.mode = 'rename';
  nameModal.uuid = group.id ?? '';
  nameModal.name = group.name ?? '';
  nameModal.open = true;
}

async function saveName() {
  if (!nameModal.name) {
    alertStore.addItem({ level: 'warning', message: t('groups.nameRequired') });
    return;
  }

  saving.value = true;
  const createBody: ApiCreateGroupRequest = { name: nameModal.name };
  const renameBody: ApiUpdateGroupRequest = { name: nameModal.name };
  const { error } = nameModal.mode === 'create' ? await postGroups({ body: createBody }) : await patchGroupsByUuid({ path: { uuid: nameModal.uuid }, body: renameBody });
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'groups.saveError') });
    return;
  }

  nameModal.open = false;
  alertStore.addItem({ level: 'success', message: t('groups.saved') });
  void load();
}

async function removeGroup() {
  if (!deleteTarget.value?.id) {
    return;
  }
  const { error } = await deleteGroupsByUuid({ path: { uuid: deleteTarget.value.id } });
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'groups.saveError') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('groups.deleted') });
  void load();
}

async function openMembers(group: ApiGroupDto) {
  membersModal.group = group;
  membersModal.open = true;
  memberQuery.value = '';
  candidates.value = [];
  await loadMembers();
}

function closeMembers() {
  membersModal.open = false;
  membersModal.group = null;
  void load();
}

async function loadMembers() {
  if (!membersModal.group?.id) {
    return;
  }
  membersLoading.value = true;
  const { data, error } = await getGroupsByUuidUsers({ path: { uuid: membersModal.group.id }, query: { limit: 100 } });
  membersLoading.value = false;

  if (error || !data) {
    members.value = [];
    alertStore.addItem({ level: 'error', message: apiError(error, 'groups.loadError') });
    return;
  }
  members.value = data.items ?? [];
}

async function searchCandidates() {
  const query = memberQuery.value.trim();
  if (!query) {
    candidates.value = [];
    return;
  }

  const { data, error } = await getUsers({ query: { q: query, limit: 5 } });
  if (error || !data) {
    candidates.value = [];
    return;
  }

  const memberIds = new Set(members.value.map((member) => member.id));
  candidates.value = (data.items ?? []).filter((user) => !memberIds.has(user.id));
}

async function addMember(candidate: ApiUserDto) {
  if (!membersModal.group?.id || !candidate.id) {
    return;
  }
  const { error } = await putGroupsByUuidUsersByUserUuid({ path: { uuid: membersModal.group.id, user_uuid: candidate.id } });
  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'groups.saveError') });
    return;
  }
  memberQuery.value = '';
  candidates.value = [];
  await loadMembers();
}

async function removeMember(member: ApiUserDto) {
  if (!membersModal.group?.id || !member.id) {
    return;
  }
  const { error } = await deleteGroupsByUuidUsersByUserUuid({ path: { uuid: membersModal.group.id, user_uuid: member.id } });
  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'groups.saveError') });
    return;
  }
  await loadMembers();
}

onMounted(load);
</script>
