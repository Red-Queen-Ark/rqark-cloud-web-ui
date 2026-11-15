<template>
  <div class="space-y-4">
    <DataToolbar>
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('users.search') }}</span>
        <input id="users-search" v-model="filters.q" type="search" class="input input-sm sm:w-64" :placeholder="t('users.searchPlaceholder')" @keyup.enter="applyFilters" />
      </label>

      <label class="fieldset">
        <span class="fieldset-legend">{{ t('users.status') }}</span>
        <select id="users-status" v-model="filters.status" class="select select-sm" @change="applyFilters">
          <option value="all">{{ t('users.statusAll') }}</option>
          <option value="active">{{ t('users.statusActive') }}</option>
          <option value="inactive">{{ t('users.statusInactive') }}</option>
        </select>
      </label>

      <button id="users-page-apply-btn" class="btn btn-sm" @click="applyFilters">{{ t('users.apply') }}</button>

      <template #actions>
        <button id="users-page-create-btn" class="btn btn-primary btn-sm" @click="openCreate">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
          {{ t('users.create') }}
        </button>
      </template>
    </DataToolbar>

    <DataListPanel
      :loading="loading"
      :loading-label="t('users.loading')"
      :empty="users.length === 0"
      :empty-title="t('users.empty')"
      :empty-description="t('users.emptyDesc')"
      :empty-action-label="t('users.create')"
      empty-action-id="users-page-create-first-btn"
      :total="total"
      :limit="limit"
      :offset="offset"
      :page-info="t('users.pageInfo', { from: offset + 1, to: Math.min(offset + limit, total), total })"
      :previous-label="t('users.previous')"
      :next-label="t('users.next')"
      @create="openCreate"
      @prev="prevPage"
      @next="nextPage"
    >
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('users.username') }}</th>
              <th>{{ t('users.email') }}</th>
              <th>{{ t('users.displayName') }}</th>
              <th>{{ t('users.roles') }}</th>
              <th>{{ t('users.status') }}</th>
              <th>{{ t('users.lastSeen') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('users.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" :class="{ 'opacity-60': !user.is_active }">
              <td>
                <div class="flex flex-wrap items-center gap-1">
                  <span class="font-medium">{{ user.username }}</span>
                  <span v-if="user.id === authStore.user?.id" class="badge badge-ghost badge-xs">{{ t('users.you') }}</span>
                </div>
              </td>
              <td>{{ user.email }}</td>
              <td>{{ user.display_name || '—' }}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <span v-if="user.is_superuser" class="badge badge-primary badge-xs">{{ t('users.superuser') }}</span>
                  <span v-if="user.is_staff" class="badge badge-secondary badge-xs">{{ t('users.staff') }}</span>
                  <span v-if="!user.is_superuser && !user.is_staff" class="badge badge-ghost badge-xs">{{ t('users.member') }}</span>
                </div>
              </td>
              <td>
                <span :class="user.is_active ? 'text-success' : 'text-error'">{{ user.is_active ? '✓' : '✗' }}</span>
              </td>
              <td class="text-base-content/70" :title="t('users.lastSeenHint')">{{ formatDateTime(user.last_seen_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <div class="flex items-center justify-end gap-1">
                  <RowActionsMenu>
                    <li>
                      <button @click="openEdit(user)">{{ t('users.edit') }}</button>
                    </li>
                    <li>
                      <button @click="openPassword(user)">{{ t('users.setPassword') }}</button>
                    </li>
                    <li v-if="user.is_active">
                      <button class="text-error" :disabled="user.id === authStore.user?.id" @click="confirmDeactivate(user)">
                        {{ t('users.deactivate') }}
                      </button>
                    </li>
                    <li v-else>
                      <button class="text-success" @click="setActive(user, true)">{{ t('users.activate') }}</button>
                    </li>
                  </RowActionsMenu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DataListPanel>

    <FormModal v-if="formOpen" :title="formMode === 'create' ? t('users.create') : t('users.edit')" :confirm-label="t('users.save')" :cancel-label="t('users.cancel')" :saving="saving" @cancel="formOpen = false" @confirm="saveForm">
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('users.username') }}</span>
        <input id="user-form-username" v-model="form.username" type="text" class="input w-full" />
      </label>
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('users.email') }}</span>
        <input id="user-form-email" v-model="form.email" type="email" class="input w-full" />
      </label>
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('users.displayName') }}</span>
        <input id="user-form-display-name" v-model="form.displayName" type="text" class="input w-full" />
      </label>
      <label v-if="formMode === 'create'" class="fieldset">
        <span class="fieldset-legend">{{ t('users.password') }}</span>
        <input id="user-form-password" v-model="form.password" type="password" autocomplete="new-password" class="input w-full" />
      </label>
      <label class="flex cursor-pointer items-center gap-2">
        <input v-model="form.isSuperuser" type="checkbox" class="checkbox checkbox-sm" />
        <span>{{ t('users.superuser') }}</span>
      </label>
      <template v-if="formMode === 'edit'">
        <label class="flex cursor-pointer items-center gap-2">
          <input v-model="form.isStaff" type="checkbox" class="checkbox checkbox-sm" />
          <span>{{ t('users.staff') }}</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input v-model="form.isActive" type="checkbox" class="checkbox checkbox-sm" />
          <span>{{ t('users.statusActive') }}</span>
        </label>
      </template>
    </FormModal>

    <FormModal
      v-if="passwordOpen"
      :title="t('users.setPassword')"
      :description="passwordTarget?.username"
      :confirm-label="t('users.save')"
      :cancel-label="t('users.cancel')"
      :saving="saving"
      @cancel="passwordOpen = false"
      @confirm="savePassword"
    >
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('users.newPassword') }}</span>
        <input id="user-password" v-model="newPassword" type="password" autocomplete="new-password" class="input w-full" />
      </label>
    </FormModal>

    <FormModal
      v-if="deactivateTarget"
      :title="t('users.deactivate')"
      :description="t('users.deactivateConfirm', { name: deactivateTarget.username })"
      confirm-class="btn-error"
      :confirm-label="t('users.deactivate')"
      :cancel-label="t('users.cancel')"
      @cancel="deactivateTarget = null"
      @confirm="deactivate"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiCreateUserRequest, ApiUserDto } from '@/api';
import { deleteUsersByUuid, getUsers, patchUsersByUuid, postUsers, putUsersByUuidPassword } from '@/api';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDateTime } from '@/utils/datetime';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const alertStore = useAlertStore();
const authStore = useAuthStore();
const apiError = useApiError();

const users = ref<ApiUserDto[]>([]);
const total = ref(0);
const limit = ref(10);
const offset = ref(0);
const loading = ref(false);

const filters = reactive({ q: '', status: 'all' as 'all' | 'active' | 'inactive' });

const formOpen = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const form = reactive({
  uuid: '',
  username: '',
  email: '',
  displayName: '',
  password: '',
  isSuperuser: false,
  isStaff: false,
  isActive: true,
});

const passwordOpen = ref(false);
const passwordTarget = ref<ApiUserDto | null>(null);
const newPassword = ref('');

const deactivateTarget = ref<ApiUserDto | null>(null);
const saving = ref(false);

async function load() {
  loading.value = true;
  const isActive = filters.status === 'all' ? undefined : filters.status === 'active';
  const { data, error } = await getUsers({
    query: {
      limit: limit.value,
      offset: offset.value,
      q: filters.q || undefined,
      is_active: isActive,
    },
  });
  loading.value = false;

  if (error || !data) {
    users.value = [];
    total.value = 0;
    alertStore.addItem({ level: 'error', message: apiError(error, 'users.loadError') });
    return;
  }

  users.value = data.items ?? [];
  total.value = data.total ?? users.value.length;
}

function applyFilters() {
  offset.value = 0;
  void load();
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  void load();
}

function nextPage() {
  offset.value += limit.value;
  void load();
}

function resetForm() {
  form.uuid = '';
  form.username = '';
  form.email = '';
  form.displayName = '';
  form.password = '';
  form.isSuperuser = false;
  form.isStaff = false;
  form.isActive = true;
}

function openCreate() {
  formMode.value = 'create';
  resetForm();
  formOpen.value = true;
}

function openEdit(user: ApiUserDto) {
  formMode.value = 'edit';
  form.uuid = user.id ?? '';
  form.username = user.username ?? '';
  form.email = user.email ?? '';
  form.displayName = user.display_name ?? '';
  form.isSuperuser = user.is_superuser ?? false;
  form.isStaff = user.is_staff ?? false;
  form.isActive = user.is_active ?? true;
  formOpen.value = true;
}

async function saveForm() {
  saving.value = true;

  if (formMode.value === 'create') {
    const body: ApiCreateUserRequest = {
      username: form.username,
      email: form.email,
      display_name: form.displayName,
      password: form.password,
      is_superuser: form.isSuperuser,
    };
    const { error } = await postUsers({ body });
    saving.value = false;
    if (error) {
      alertStore.addItem({ level: 'error', message: apiError(error, 'users.saveError') });
      return;
    }
  } else {
    const { error } = await patchUsersByUuid({
      path: { uuid: form.uuid },
      body: {
        username: form.username,
        email: form.email,
        display_name: form.displayName,
        is_superuser: form.isSuperuser,
        is_staff: form.isStaff,
        is_active: form.isActive,
      },
    });
    saving.value = false;
    if (error) {
      alertStore.addItem({ level: 'error', message: apiError(error, 'users.saveError') });
      return;
    }
  }

  formOpen.value = false;
  alertStore.addItem({ level: 'success', message: t('users.saved') });
  void load();
}

function openPassword(user: ApiUserDto) {
  passwordTarget.value = user;
  newPassword.value = '';
  passwordOpen.value = true;
}

async function savePassword() {
  if (!passwordTarget.value?.id || !newPassword.value) {
    alertStore.addItem({ level: 'warning', message: t('users.passwordRequired') });
    return;
  }

  saving.value = true;
  const { error } = await putUsersByUuidPassword({ path: { uuid: passwordTarget.value.id }, body: { new_password: newPassword.value } });
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'users.saveError') });
    return;
  }

  passwordOpen.value = false;
  alertStore.addItem({ level: 'success', message: t('users.passwordSaved') });
}

function confirmDeactivate(user: ApiUserDto) {
  deactivateTarget.value = user;
}

async function deactivate() {
  if (!deactivateTarget.value?.id) {
    return;
  }
  const { error } = await deleteUsersByUuid({ path: { uuid: deactivateTarget.value.id } });
  deactivateTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'users.saveError') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('users.saved') });
  void load();
}

async function setActive(user: ApiUserDto, isActive: boolean) {
  if (!user.id) {
    return;
  }
  const { error } = await patchUsersByUuid({ path: { uuid: user.id }, body: { is_active: isActive } });
  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'users.saveError') });
    return;
  }
  void load();
}

onMounted(load);
</script>
