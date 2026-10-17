<template>
  <div data-testid="task-detail-page" class="flex max-h-[calc(100dvh-6.5rem)] min-h-0 flex-col gap-4">
    <!-- The back action sits to the left of the heading on every detail page, so
         the way out of one is always in the same place. -->
    <div class="flex shrink-0 flex-wrap items-start gap-2">
      <RouterLink id="task-detail-back-btn" class="btn btn-ghost btn-sm" :to="{ name: 'tasks', params: { lang } }">
        <ArrowLeftIcon class="h-4 w-4" />
        {{ t('tasks.back') }}
      </RouterLink>

      <div class="ml-auto flex items-center gap-2">
        <button id="task-detail-refresh-btn" class="btn btn-ghost btn-sm btn-square" :aria-label="t('tasks.refresh')" @click="loadTask">
          <RefreshIcon class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div v-if="loadingTask" class="bg-base-200/60 border-base-300 rounded-box border p-4">
      <div class="space-y-3">
        <div class="skeleton h-10 w-full"></div>
        <div class="skeleton h-10 w-2/3"></div>
      </div>
    </div>

    <div v-else-if="notFound" data-testid="task-detail-not-found" class="bg-base-200/60 border-base-300 rounded-box border">
      <div class="flex flex-col items-center justify-center px-6 py-20 text-center">
        <img src="/logo.svg" alt="" class="mb-4 h-24 w-24 opacity-50" />
        <p class="mb-1 text-xl font-bold">{{ t('tasks.detailNotFound') }}</p>
        <p class="text-base-content/70 mb-4 max-w-sm text-sm">{{ t('tasks.detailNotFoundDesc') }}</p>
        <p class="text-base-content/60 font-mono text-xs">{{ uuid }}</p>
      </div>
    </div>

    <div v-else-if="task" class="flex min-h-0 flex-1 flex-col gap-4">
      <div class="bg-base-200/60 border-base-300 rounded-box shrink-0 border p-4">
        <h2 data-testid="task-detail-name" class="border-base-300 mb-4 truncate border-b pb-3 text-lg font-bold tracking-tight">{{ task.name }}</h2>

        <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div class="min-w-0">
            <dt class="text-base-content/60 text-xs">{{ t('tasks.scheduleLabel') }}</dt>
            <dd data-testid="task-detail-schedule" class="truncate">{{ summary }}</dd>
          </div>
          <div class="min-w-0">
            <dt class="text-base-content/60 text-xs">{{ t('tasks.agent') }}</dt>
            <dd class="truncate">{{ task.agent_name }}</dd>
          </div>
          <div class="min-w-0">
            <dt class="text-base-content/60 text-xs">{{ t('tasks.provider') }}</dt>
            <dd class="truncate">{{ task.provider_name }}</dd>
          </div>
          <div class="min-w-0">
            <dt class="text-base-content/60 text-xs">{{ t('tasks.enabled') }}</dt>
            <dd>
              <span data-testid="task-detail-enabled" :class="task.enabled ? 'badge badge-success badge-sm' : 'badge badge-ghost badge-sm'">
                {{ task.enabled ? t('tasks.enabledOn') : t('tasks.enabledOff') }}
              </span>
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-base-content/60 text-xs">{{ t('tasks.nextRun') }}</dt>
            <dd data-testid="task-detail-next-run" class="truncate">{{ task.next_run_at ? formatDateTime(task.next_run_at) : t('tasks.never') }}</dd>
          </div>
          <div class="min-w-0">
            <dt class="text-base-content/60 text-xs">{{ t('tasks.updated') }}</dt>
            <dd class="truncate">{{ formatDateTime(task.updated_at) }}</dd>
          </div>
        </dl>

        <div class="border-base-300 mt-4 border-t pt-3">
          <p class="text-base-content/60 text-xs">{{ t('tasks.prompt') }}</p>
          <p data-testid="task-detail-prompt" class="scrollbar-thin max-h-24 overflow-y-auto whitespace-pre-wrap text-sm">{{ task.prompt }}</p>
        </div>
      </div>

      <div class="bg-base-200/60 border-base-300 rounded-box flex min-h-0 flex-1 flex-col border p-2 sm:p-4">
        <div class="flex shrink-0 flex-wrap items-center gap-2 px-1 pb-2">
          <h2 class="text-base font-semibold">{{ t('tasks.runs') }}</h2>
          <span class="badge badge-ghost badge-sm">{{ total }}</span>
          <button id="task-detail-runs-refresh-btn" class="btn btn-ghost btn-xs btn-square ml-auto" :aria-label="t('tasks.refresh')" @click="loadRuns">
            <RefreshIcon class="h-3.5 w-3.5" />
          </button>
        </div>

        <div v-if="loadingRuns" class="flex min-h-0 flex-1 items-center justify-center py-16">
          <span class="loading loading-spinner loading-md text-primary" :aria-label="t('tasks.loading')"></span>
        </div>

        <div v-else-if="runs.length === 0" data-testid="task-detail-runs-empty" class="flex min-h-0 flex-1 flex-col items-center justify-center py-16 text-center">
          <img src="/logo.svg" alt="" class="mb-3 h-16 w-16 opacity-40" />
          <p class="mb-1 font-semibold">{{ t('tasks.runsEmpty') }}</p>
          <p class="text-base-content/70 max-w-sm text-sm">{{ t('tasks.runsEmptyDesc') }}</p>
        </div>

        <div v-else class="scrollbar-thin min-h-0 flex-1 overflow-auto">
          <table data-testid="task-detail-runs-table" class="table table-pin-rows w-full whitespace-nowrap">
            <thead>
              <tr>
                <th>{{ t('tasks.scheduledAt') }}</th>
                <th>{{ t('tasks.trigger') }}</th>
                <th>{{ t('tasks.runStatusLabel') }}</th>
                <th>{{ t('tasks.duration') }}</th>
                <th>{{ t('tasks.error') }}</th>
                <th class="bg-base-200 sticky right-0 text-right">{{ t('tasks.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="run in runs" :key="run.id" :data-testid="`task-run-row-${run.id}`">
                <td class="text-base-content/70">{{ formatDateTime(run.scheduled_at) }}</td>
                <td class="text-base-content/70">{{ triggerLabel(run.trigger) }}</td>
                <td>
                  <span :class="['badge', 'badge-sm', statusStyle(run.status).badgeClass]">
                    {{ statusLabel(run.status) }}
                  </span>
                </td>
                <td class="text-base-content/70">{{ formatDuration(run) || '—' }}</td>
                <td class="text-base-content/70 max-w-64 truncate" :title="run.error">{{ run.error || '—' }}</td>
                <td class="bg-base-200 sticky right-0 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <RouterLink v-if="run.session_id && run.id" :data-testid="`task-run-view-${run.id}`" class="btn btn-ghost btn-xs" :to="{ name: 'taskSession', params: { lang, uuid, session: run.session_id } }">
                      {{ t('tasks.view') }}
                    </RouterLink>
                    <span v-else class="text-base-content/40">—</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="total > limit" class="flex shrink-0 items-center justify-between px-2 pt-3">
          <span class="text-base-content/70 text-xs">{{ pageInfo }}</span>
          <div class="join">
            <button id="task-detail-runs-prev" class="btn btn-sm join-item" :disabled="offset === 0" @click="page(-1)">{{ t('tasks.previous') }}</button>
            <button id="task-detail-runs-next" class="btn btn-sm join-item" :disabled="offset + limit >= total" @click="page(1)">{{ t('tasks.next') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getTasksByUuid, getTasksByUuidRuns, type ApiTaskDto, type ApiTaskRunDto } from '@/api';
import { apiErrorCode } from '@/api-client/error';
import ArrowLeftIcon from '@/components/svg/ArrowLeftIcon.vue';
import RefreshIcon from '@/components/svg/RefreshIcon.vue';
import { useApiError } from '@/composables/useApiError';
import { formatDuration, taskRunStatusStyle, taskScheduleSummary, taskTriggerLabel } from '@/config/tasks';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const RUNS_PER_PAGE = 20;

const { t } = useI18n();
const route = useRoute();
const alertStore = useAlertStore();
const apiError = useApiError();

const lang = computed(() => route.params.lang as string);
const uuid = computed(() => String(route.params.uuid ?? ''));

const task = ref<ApiTaskDto | null>(null);
const runs = ref<ApiTaskRunDto[]>([]);
const total = ref(0);
const offset = ref(0);
const limit = RUNS_PER_PAGE;

const loadingTask = ref(true);
const loadingRuns = ref(true);
const notFound = ref(false);

const summary = computed(() => (task.value ? taskScheduleSummary(task.value, t as (key: string, named?: Record<string, unknown>) => string) : ''));

const pageInfo = computed(() => {
  const first = total.value === 0 ? 0 : offset.value + 1;
  const last = Math.min(offset.value + limit, total.value);
  return t('tasks.pageInfo', { first, last, total: total.value });
});

function statusStyle(status?: string) {
  return taskRunStatusStyle(status);
}

function statusLabel(status?: string): string {
  const style = taskRunStatusStyle(status);
  return style.labelKey ? t(style.labelKey) : (status ?? '');
}

function triggerLabel(trigger?: string): string {
  return taskTriggerLabel(trigger, t as (key: string, named?: Record<string, unknown>) => string);
}

async function loadTask() {
  loadingTask.value = true;
  notFound.value = false;

  const { data, error } = await getTasksByUuid({ path: { uuid: uuid.value } });
  loadingTask.value = false;

  if (error || !data) {
    task.value = null;
    if (apiErrorCode(error) === 'NOT_FOUND') {
      notFound.value = true;
      return;
    }
    alertStore.addItem({ level: 'error', message: apiError(error, 'tasks.loadError') });
    return;
  }

  task.value = data;
}

async function loadRuns() {
  loadingRuns.value = true;
  const { data, error } = await getTasksByUuidRuns({ path: { uuid: uuid.value }, query: { limit, offset: offset.value } });
  loadingRuns.value = false;

  if (error || !data) {
    runs.value = [];
    total.value = 0;
    if (apiErrorCode(error) !== 'NOT_FOUND') {
      alertStore.addItem({ level: 'error', message: apiError(error, 'tasks.runsLoadError') });
    }
    return;
  }

  // The endpoint answers { items, total, limit, offset }. The page keeps its own
  // window so a paging click does not have to re-read the envelope.
  runs.value = (data.items ?? []) as ApiTaskRunDto[];
  total.value = data.total ?? 0;
}

function page(direction: -1 | 1) {
  const next = offset.value + direction * limit;
  if (next < 0) {
    return;
  }
  offset.value = next;
  void loadRuns();
}

onMounted(async () => {
  await loadTask();
  if (!notFound.value) {
    await loadRuns();
  }
});

watch(uuid, async () => {
  offset.value = 0;
  await loadTask();
  if (!notFound.value) {
    await loadRuns();
  }
});
</script>
