<template>
  <div data-testid="todo-page" class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <p class="text-base-content/70 max-w-md text-xs">{{ t('todos.hint') }}</p>

      <div class="ml-auto flex items-center gap-2">
        <div role="tablist" class="tabs tabs-boxed tabs-sm">
          <button v-for="option in filters" :key="option.value" role="tab" class="tab" :class="{ 'tab-active': filter === option.value }" :data-testid="`todo-filter-${option.value}`" @click="setFilter(option.value)">
            {{ t(option.labelKey) }}
          </button>
        </div>
        <button id="todo-page-refresh-btn" class="btn btn-ghost btn-sm btn-square" :aria-label="t('todos.refresh')" @click="load">
          <RefreshIcon class="h-4 w-4" />
        </button>
        <button id="todo-page-create-btn" class="btn btn-primary btn-sm" @click="openCreate">
          <PlusIcon class="h-4 w-4" />
          {{ t('todos.create') }}
        </button>
      </div>
    </div>

    <div class="bg-base-200/60 border-base-300 rounded-box border p-2 sm:p-4">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <span class="loading loading-spinner loading-md text-primary" :aria-label="t('todos.loading')"></span>
      </div>

      <div v-else-if="todos.length === 0" data-testid="todo-page-empty" class="flex flex-col items-center justify-center py-20 text-center">
        <img src="/logo.svg" alt="" class="mb-4 h-24 w-24 opacity-50" />
        <p class="mb-1 text-xl font-bold">{{ t('todos.empty') }}</p>
        <p class="text-base-content/70 mb-4 max-w-sm text-sm">{{ t('todos.emptyDesc') }}</p>
        <button id="todo-page-create-first-btn" class="btn btn-primary btn-sm" @click="openCreate">{{ t('todos.create') }}</button>
      </div>

      <ul v-else data-testid="todo-page-list" class="divide-base-300 divide-y">
        <li v-for="todo in todos" :key="todo.id" :data-testid="`todo-row-${todo.id}`" class="flex items-start gap-3 py-3">
          <input :id="`todo-done-${todo.id}`" type="checkbox" class="checkbox checkbox-primary checkbox-sm mt-1" :checked="todo.done === true" :aria-label="t('todos.done')" @change="toggleDone(todo)" />

          <div class="min-w-0 flex-1">
            <p class="font-medium break-words" :class="{ 'text-base-content/50 line-through': todo.done === true }">{{ todo.title }}</p>
            <p v-if="todo.description" class="text-base-content/70 mt-1 text-sm whitespace-pre-wrap break-words">{{ todo.description }}</p>
            <div class="text-base-content/60 mt-1 flex flex-wrap items-center gap-3 text-xs">
              <span v-if="todo.due_at" :data-testid="`todo-due-${todo.id}`">{{ t('todos.dueAt') }} {{ formatDateTime(todo.due_at) }}</span>
              <span v-if="todo.done_at">{{ t('todos.doneAt') }} {{ formatDateTime(todo.done_at) }}</span>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button class="btn btn-ghost btn-xs" @click="openEdit(todo)">{{ t('todos.edit') }}</button>
            <button class="btn btn-ghost btn-xs text-error" @click="deleteTarget = todo">{{ t('todos.delete') }}</button>
          </div>
        </li>
      </ul>
    </div>

    <FormModal v-if="form.open" :title="form.uuid ? t('todos.edit') : t('todos.create')" :confirm-label="t('todos.save')" :cancel-label="t('todos.cancel')" :saving="saving" @cancel="form.open = false" @confirm="save">
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('todos.titleLabel') }}</span>
        <input id="todo-title" v-model="form.title" type="text" class="input w-full" maxlength="255" :placeholder="t('todos.titlePlaceholder')" />
      </label>

      <label class="fieldset">
        <span class="fieldset-legend">{{ t('todos.description') }}</span>
        <textarea id="todo-description" v-model="form.description" class="textarea h-24 w-full" :placeholder="t('todos.descriptionPlaceholder')"></textarea>
      </label>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="fieldset">
          <span class="fieldset-legend">{{ t('todos.dueAt') }}</span>
          <input id="todo-due-at" v-model="form.dueAt" type="datetime-local" class="input w-full" />
        </label>

        <label class="fieldset">
          <span class="fieldset-legend">{{ t('todos.sortOrder') }}</span>
          <input id="todo-sort-order" v-model.number="form.sortOrder" type="number" class="input w-full" />
        </label>
      </div>
    </FormModal>

    <div v-if="deleteTarget" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">{{ t('todos.delete') }}</h3>
        <p class="py-4">{{ t('todos.deleteConfirm', { title: deleteTarget.title }) }}</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="deleteTarget = null">{{ t('todos.cancel') }}</button>
          <button id="todo-delete-confirm-btn" class="btn btn-error" @click="remove">{{ t('todos.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { deleteTodosByUuid, getTodos, postTodos, putTodosByUuid, type ApiCreateTodoRequest, type ApiTodoDto, type ApiUpdateTodoRequest } from '@/api';
import FormModal from '@/components/FormModal.vue';
import PlusIcon from '@/components/svg/PlusIcon.vue';
import RefreshIcon from '@/components/svg/RefreshIcon.vue';
import { useApiError } from '@/composables/useApiError';
import { fromDateTimeLocal, toDateTimeLocal } from '@/config/tasks';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

type DoneFilter = 'all' | 'open' | 'done';

interface TodoDraft {
  title: string;
  description: string;
  sort_order: number;
  due_at?: string | null;
}

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();

const filters: { value: DoneFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'todos.filterAll' },
  { value: 'open', labelKey: 'todos.filterOpen' },
  { value: 'done', labelKey: 'todos.filterDone' },
];

const todos = ref<ApiTodoDto[]>([]);
const filter = ref<DoneFilter>('all');
const loading = ref(false);
const saving = ref(false);
const deleteTarget = ref<ApiTodoDto | null>(null);

const form = reactive({
  open: false,
  uuid: '',
  title: '',
  description: '',
  dueAt: '',
  hadDueAt: false,
  sortOrder: 0,
});

async function load() {
  loading.value = true;
  const query = filter.value === 'all' ? {} : { done: filter.value === 'done' };
  const result = await getTodos({ query });
  loading.value = false;

  if (result.error || !result.data) {
    todos.value = [];
    alertStore.addItem({ level: 'error', message: apiError(result.error, 'todos.loadError') });
    return;
  }
  todos.value = result.data;
}

function setFilter(value: DoneFilter) {
  filter.value = value;
  void load();
}

function openCreate() {
  form.uuid = '';
  form.title = '';
  form.description = '';
  form.dueAt = '';
  form.hadDueAt = false;
  form.sortOrder = todos.value.length;
  form.open = true;
}

function openEdit(todo: ApiTodoDto) {
  form.uuid = todo.id ?? '';
  form.title = todo.title ?? '';
  form.description = todo.description ?? '';
  form.dueAt = toDateTimeLocal(todo.due_at);
  form.hadDueAt = Boolean(todo.due_at);
  form.sortOrder = todo.sort_order ?? 0;
  form.open = true;
}

async function toggleDone(todo: ApiTodoDto) {
  if (!todo.id) {
    return;
  }
  const { error } = await putTodosByUuid({ path: { uuid: todo.id }, body: { done: todo.done !== true } });

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'todos.saveError') });
    void load();
    return;
  }
  void load();
}

async function save() {
  if (!form.title.trim()) {
    alertStore.addItem({ level: 'warning', message: t('todos.titleRequired') });
    return;
  }

  const dueAt = fromDateTimeLocal(form.dueAt);
  const draft: TodoDraft = {
    title: form.title.trim(),
    description: form.description,
    sort_order: form.sortOrder,
  };
  if (dueAt) {
    draft.due_at = dueAt;
  } else if (form.hadDueAt) {
    draft.due_at = null;
  }

  saving.value = true;
  const request = form.uuid ? putTodosByUuid({ path: { uuid: form.uuid }, body: draft as ApiUpdateTodoRequest }) : postTodos({ body: draft as ApiCreateTodoRequest });
  const { error } = await request;
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'todos.saveError') });
    return;
  }

  form.open = false;
  alertStore.addItem({ level: 'success', message: t('todos.saved') });
  void load();
}

async function remove() {
  if (!deleteTarget.value?.id) {
    return;
  }
  const { error } = await deleteTodosByUuid({ path: { uuid: deleteTarget.value.id } });
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'todos.saveError') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('todos.deleted') });
  void load();
}

onMounted(load);
</script>
