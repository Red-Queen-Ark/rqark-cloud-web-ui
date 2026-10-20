<template>
  <div data-testid="task-page" class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <p class="text-base-content/70 max-w-md text-xs">{{ t('tasks.hint') }}</p>

      <div class="ml-auto flex items-center gap-2">
        <button id="task-page-refresh-btn" class="btn btn-ghost btn-sm btn-square" :aria-label="t('tasks.refresh')" @click="load">
          <RefreshIcon class="h-4 w-4" />
        </button>
        <button id="task-page-create-btn" class="btn btn-primary btn-sm" @click="openCreate">
          <PlusIcon class="h-4 w-4" />
          {{ t('tasks.create') }}
        </button>
      </div>
    </div>

    <div class="bg-base-200/60 border-base-300 rounded-box border p-2 sm:p-4">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <span class="loading loading-spinner loading-md text-primary" :aria-label="t('tasks.loading')"></span>
      </div>

      <div v-else-if="tasks.length === 0" data-testid="task-page-empty" class="flex flex-col items-center justify-center py-20 text-center">
        <img src="/logo.svg" alt="" class="mb-4 h-24 w-24 opacity-50" />
        <p class="mb-1 text-xl font-bold">{{ t('tasks.empty') }}</p>
        <p class="text-base-content/70 mb-4 max-w-sm text-sm">{{ t('tasks.emptyDesc') }}</p>
        <button id="task-page-create-first-btn" class="btn btn-primary btn-sm" @click="openCreate">{{ t('tasks.create') }}</button>
      </div>

      <div v-else class="scrollbar-thin table-scroll overflow-x-auto">
        <table data-testid="task-page-table" class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('tasks.name') }}</th>
              <th>{{ t('tasks.scheduleLabel') }}</th>
              <th>{{ t('tasks.agent') }}</th>
              <th>{{ t('tasks.provider') }}</th>
              <th>{{ t('tasks.nextRun') }}</th>
              <th>{{ t('tasks.enabled') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('tasks.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in tasks" :key="task.id" :data-testid="`task-row-${task.id}`">
              <td class="font-medium">{{ task.name }}</td>
              <td class="text-base-content/70">{{ scheduleSummary(task) }}</td>
              <td class="text-base-content/70">{{ task.agent_name }}</td>
              <td class="text-base-content/70">{{ task.provider_name }}</td>
              <td class="text-base-content/70">{{ task.next_run_at ? formatDateTime(task.next_run_at) : t('tasks.never') }}</td>
              <td>
                <span :class="task.enabled ? 'badge badge-success badge-sm' : 'badge badge-ghost badge-sm'">
                  {{ task.enabled ? t('tasks.enabledOn') : t('tasks.enabledOff') }}
                </span>
              </td>
              <td class="bg-base-200 sticky right-0 text-right">
                <div class="flex items-center justify-end gap-1">
                  <RowActionsMenu>
                    <li v-if="task.id">
                      <RouterLink :data-testid="`task-view-${task.id}`" :to="{ name: 'taskDetail', params: { lang, uuid: task.id } }">{{ t('tasks.view') }}</RouterLink>
                    </li>
                    <li>
                      <button @click="openEdit(task)">{{ t('tasks.edit') }}</button>
                    </li>
                    <li>
                      <button class="text-error" @click="deleteTarget = task">{{ t('tasks.delete') }}</button>
                    </li>
                  </RowActionsMenu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <FormModal v-if="form.open" :title="form.uuid ? t('tasks.edit') : t('tasks.create')" :confirm-label="t('tasks.save')" :cancel-label="t('tasks.cancel')" :saving="saving" box-class="max-w-3xl" @cancel="form.open = false" @confirm="save">
      <template #header-actions>
        <label class="flex shrink-0 cursor-pointer items-center gap-2 pt-1">
          <span class="text-base-content/70 text-sm">{{ t('tasks.enabled') }}</span>
          <input id="task-enabled" v-model="form.enabled" type="checkbox" class="toggle toggle-sm" />
        </label>
      </template>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="fieldset sm:col-span-2">
          <span class="fieldset-legend">{{ t('tasks.name') }}</span>
          <input id="task-name" v-model="form.name" type="text" class="input w-full" :placeholder="t('tasks.namePlaceholder')" />
        </label>

        <label class="fieldset">
          <span class="fieldset-legend">{{ t('tasks.agent') }}</span>
          <select id="task-agent" v-model="form.agentName" class="select w-full">
            <option disabled value="">{{ t('tasks.agentRequired') }}</option>
            <option v-for="name in agentNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>

        <label class="fieldset">
          <span class="fieldset-legend">{{ t('tasks.provider') }}</span>
          <select id="task-provider" v-model="form.providerName" class="select w-full">
            <option disabled value="">{{ t('tasks.providerRequired') }}</option>
            <option v-for="name in providerNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>

        <label class="fieldset sm:col-span-2">
          <span class="fieldset-legend">{{ t('tasks.prompt') }}</span>
          <textarea id="task-prompt" v-model="form.prompt" class="textarea min-h-24 w-full" :placeholder="t('tasks.promptPlaceholder')"></textarea>
        </label>

        <fieldset class="fieldset sm:col-span-2">
          <legend class="fieldset-legend">{{ t('tasks.scheduleLabel') }}</legend>
          <div class="join">
            <button
              v-for="kind in TASK_SCHEDULE_KINDS"
              :id="`task-kind-${kind}`"
              :key="kind"
              type="button"
              class="btn join-item btn-sm"
              :class="form.schedule.kind === kind ? 'btn-primary' : 'btn-outline'"
              @click="form.schedule.kind = kind"
            >
              {{ t(`tasks.kind${kind[0].toUpperCase()}${kind.slice(1)}`) }}
            </button>
          </div>
        </fieldset>

        <label v-if="form.schedule.kind === 'at'" class="fieldset sm:col-span-2">
          <span class="fieldset-legend">{{ t('tasks.runAt') }}</span>
          <input id="task-run-at" v-model="form.schedule.runAt" type="datetime-local" class="input w-full" />
        </label>

        <label v-else-if="form.schedule.kind === 'every'" class="fieldset sm:col-span-2">
          <span class="fieldset-legend">{{ t('tasks.everyMinutes') }}</span>
          <input id="task-every-minutes" v-model.number="form.schedule.everyMinutes" type="number" min="1" step="1" class="input w-full" />
          <span class="text-base-content/60 text-xs">{{ t('tasks.everyMinutesHint') }}</span>
        </label>

        <template v-else>
          <label class="fieldset">
            <span class="fieldset-legend">{{ t('tasks.repeat') }}</span>
            <select id="task-repeat" :value="form.schedule.pattern.type" class="select w-full" @change="changePatternType(($event.target as HTMLSelectElement).value)">
              <option v-for="type in CRON_PATTERN_TYPES" :key="type" :value="type">{{ t(`tasks.repeat${type[0].toUpperCase()}${type.slice(1)}`) }}</option>
            </select>
          </label>

          <label class="fieldset">
            <span class="fieldset-legend">{{ t('tasks.timezone') }}</span>
            <input id="task-timezone" v-model="form.schedule.timezone" type="text" class="input w-full" />
          </label>

          <template v-if="form.schedule.pattern.type !== 'custom'">
            <label class="fieldset">
              <span class="fieldset-legend">{{ t('tasks.atTime') }}</span>
              <input id="task-at-time" :value="atTime" type="time" step="60" class="input w-full" @input="setAtTime(($event.target as HTMLInputElement).value)" />
            </label>

            <label v-if="form.schedule.pattern.type === 'weekly'" class="fieldset">
              <span class="fieldset-legend">{{ t('tasks.weekdayLabel') }}</span>
              <select id="task-weekday" :value="form.schedule.pattern.weekday" class="select w-full" @change="setWeekday(Number(($event.target as HTMLSelectElement).value))">
                <option v-for="day in WEEKDAY_VALUES" :key="day" :value="day">{{ t(`tasks.weekday.${day}`) }}</option>
              </select>
            </label>

            <label v-if="form.schedule.pattern.type === 'monthly'" class="fieldset">
              <span class="fieldset-legend">{{ t('tasks.dayOfMonth') }}</span>
              <select id="task-day-of-month" :value="form.schedule.pattern.dayOfMonth" class="select w-full" @change="setDayOfMonth(Number(($event.target as HTMLSelectElement).value))">
                <option v-for="day in daysOfMonth()" :key="day" :value="day">{{ day }}</option>
              </select>
            </label>
          </template>

          <label v-else class="fieldset sm:col-span-2">
            <span class="fieldset-legend">{{ t('tasks.cronExpr') }}</span>
            <input id="task-cron-expr" :value="form.schedule.pattern.expr" type="text" class="input w-full font-mono" :placeholder="t('tasks.cronExprPlaceholder')" @input="setCustomExpr(($event.target as HTMLInputElement).value)" />
            <span class="text-base-content/60 text-xs">{{ t('tasks.cronExprHint') }}</span>
          </label>
        </template>
      </div>
    </FormModal>

    <FormModal
      v-if="deleteTarget"
      :title="t('tasks.delete')"
      :description="t('tasks.deleteConfirm', { name: deleteTarget.name ?? '' })"
      confirm-class="btn-error"
      :confirm-label="t('tasks.delete')"
      :cancel-label="t('tasks.cancel')"
      @cancel="deleteTarget = null"
      @confirm="remove"
    >
      <p class="text-base-content/70 text-sm">{{ scheduleSummary(deleteTarget) }}</p>
    </FormModal>
  </div>
</template>

<script setup lang="ts">
import { deleteTasksByUuid, getAgentsNames, getProvidersModels, getTasks, postTasks, putTasksByUuid, type ApiCreateTaskRequest, type ApiTaskDto } from '@/api';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import PlusIcon from '@/components/svg/PlusIcon.vue';
import RefreshIcon from '@/components/svg/RefreshIcon.vue';
import { useApiError } from '@/composables/useApiError';
import { CRON_PATTERN_TYPES, daysOfMonth, padTime, WEEKDAY_VALUES } from '@/config/cron';
import { providerLabel } from '@/config/providers';
import { emptyTaskSchedule, MIN_TASK_EVERY_SECONDS, taskScheduleBody, taskScheduleForm, taskScheduleSummary, TASK_SCHEDULE_KINDS, type TaskScheduleForm } from '@/config/tasks';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
const alertStore = useAlertStore();
const lang = computed(() => route.params.lang as string);
const apiError = useApiError();

const tasks = ref<ApiTaskDto[]>([]);
const agentNames = ref<string[]>([]);
const providerNames = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);

const form = reactive({
  open: false,
  uuid: '',
  name: '',
  prompt: '',
  agentName: '',
  providerName: '',
  enabled: true,
  schedule: emptyTaskSchedule() as TaskScheduleForm,
});
const deleteTarget = ref<ApiTaskDto | null>(null);

const atTime = computed(() => {
  const pattern = form.schedule.pattern;
  if (pattern.type === 'custom') {
    return '09:00';
  }
  return `${padTime(pattern.hour)}:${padTime(pattern.minute)}`;
});

function scheduleSummary(task: ApiTaskDto): string {
  return taskScheduleSummary(task, t as (key: string, named?: Record<string, unknown>) => string);
}

function changePatternType(type: string) {
  const previous = form.schedule.pattern;
  const at = previous.type === 'custom' ? { hour: 9, minute: 0 } : { hour: previous.hour, minute: previous.minute };

  if (type === 'daily' || type === 'weekdays') {
    form.schedule.pattern = { type, ...at };
    return;
  }
  if (type === 'weekly') {
    form.schedule.pattern = { type, ...at, weekday: 1 };
    return;
  }
  if (type === 'monthly') {
    form.schedule.pattern = { type, ...at, dayOfMonth: 1 };
    return;
  }
  form.schedule.pattern = { type: 'custom', expr: '0 9 * * *' };
}

function setAtTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  const pattern = form.schedule.pattern;
  if (pattern.type === 'custom' || Number.isNaN(hour) || Number.isNaN(minute)) {
    return;
  }
  form.schedule.pattern = { ...pattern, hour, minute };
}

function setWeekday(weekday: number) {
  const pattern = form.schedule.pattern;
  if (pattern.type === 'weekly') {
    form.schedule.pattern = { ...pattern, weekday };
  }
}

function setDayOfMonth(dayOfMonth: number) {
  const pattern = form.schedule.pattern;
  if (pattern.type === 'monthly') {
    form.schedule.pattern = { ...pattern, dayOfMonth };
  }
}

function setCustomExpr(expr: string) {
  form.schedule.pattern = { type: 'custom', expr };
}

async function load() {
  loading.value = true;
  const [taskResult, agentResult, providerResult] = await Promise.all([getTasks(), getAgentsNames(), getProvidersModels()]);
  loading.value = false;

  if (taskResult.error || !taskResult.data) {
    tasks.value = [];
    alertStore.addItem({ level: 'error', message: apiError(taskResult.error, 'tasks.loadError') });
    return;
  }
  tasks.value = taskResult.data;

  agentNames.value = (agentResult.data ?? []).map((entry) => entry.name ?? '').filter((name) => name !== '');
  providerNames.value = [...new Set((providerResult.data ?? []).map(providerLabel).filter((name) => name !== ''))];
}

function openCreate() {
  form.uuid = '';
  form.name = '';
  form.prompt = '';
  form.agentName = agentNames.value[0] ?? '';
  form.providerName = providerNames.value[0] ?? '';
  form.enabled = true;
  form.schedule = emptyTaskSchedule();
  form.open = true;
}

function openEdit(task: ApiTaskDto) {
  form.uuid = task.id ?? '';
  form.name = task.name ?? '';
  form.prompt = task.prompt ?? '';
  form.agentName = task.agent_name ?? '';
  form.providerName = task.provider_name ?? '';
  form.enabled = task.enabled !== false;
  form.schedule = taskScheduleForm(task);
  form.open = true;
}

function validationError(): string | undefined {
  if (!form.name.trim()) {
    return t('tasks.nameRequired');
  }
  if (!form.prompt.trim()) {
    return t('tasks.promptRequired');
  }
  if (!form.agentName) {
    return t('tasks.agentRequired');
  }
  if (!form.providerName) {
    return t('tasks.providerRequired');
  }
  if (form.schedule.kind === 'at' && !form.schedule.runAt) {
    return t('tasks.runAtRequired');
  }
  if (form.schedule.kind === 'every' && form.schedule.everyMinutes * 60 < MIN_TASK_EVERY_SECONDS) {
    return t('tasks.everyMinutesInvalid');
  }
  if (form.schedule.kind === 'cron' && form.schedule.pattern.type === 'custom' && !form.schedule.pattern.expr.trim()) {
    return t('tasks.cronExprRequired');
  }
  return undefined;
}

async function save() {
  const problem = validationError();
  if (problem) {
    alertStore.addItem({ level: 'warning', message: problem });
    return;
  }

  saving.value = true;
  const body: ApiCreateTaskRequest = {
    name: form.name.trim(),
    prompt: form.prompt,
    agent_name: form.agentName,
    provider_name: form.providerName,
    enabled: form.enabled,
    ...taskScheduleBody(form.schedule),
  };
  const { error } = form.uuid ? await putTasksByUuid({ path: { uuid: form.uuid }, body }) : await postTasks({ body });
  saving.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'tasks.saveError') });
    return;
  }

  form.open = false;
  alertStore.addItem({ level: 'success', message: t('tasks.saved') });
  void load();
}

async function remove() {
  if (!deleteTarget.value?.id) {
    return;
  }
  const { error } = await deleteTasksByUuid({ path: { uuid: deleteTarget.value.id } });
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'tasks.saveError') });
    return;
  }

  alertStore.addItem({ level: 'success', message: t('tasks.deleted') });
  void load();
}

onMounted(load);
</script>
