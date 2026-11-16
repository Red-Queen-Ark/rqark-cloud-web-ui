<template>
  <div class="space-y-4">
    <p class="text-base-content/70 max-w-2xl text-xs" data-testid="usage-hint">{{ t('usage.hint') }}</p>

    <div class="divider my-0"></div>

    <div class="flex flex-wrap items-end gap-2">
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('usage.timeRange') }}</span>
        <select id="usage-range" v-model="rangePreset" data-testid="usage-range" class="select select-sm" @change="load">
          <option v-for="preset in USAGE_RANGE_PRESETS" :key="preset" :value="preset">{{ t(`usage.range.${preset}`) }}</option>
        </select>
      </label>

      <label v-if="rangePreset === 'custom'" class="fieldset">
        <span class="fieldset-legend">{{ t('usage.from') }}</span>
        <input id="usage-from" v-model="customFrom" data-testid="usage-from" type="date" class="input input-sm" @change="load" />
      </label>

      <label v-if="rangePreset === 'custom'" class="fieldset">
        <span class="fieldset-legend">{{ t('usage.to') }}</span>
        <input id="usage-to" v-model="customTo" data-testid="usage-to" type="date" class="input input-sm" @change="load" />
      </label>

      <label class="fieldset">
        <span class="fieldset-legend">{{ t('usage.apiKey') }}</span>
        <select id="usage-api-key" v-model="apiKeyName" data-testid="usage-api-key" class="select select-sm" @change="load">
          <option value="">{{ t('usage.apiKeyAll') }}</option>
          <option v-for="name in apiKeyNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>

      <label class="fieldset">
        <span class="fieldset-legend">{{ t('usage.source') }}</span>
        <select id="usage-source" v-model="source" data-testid="usage-source" class="select select-sm" @change="load">
          <option value="">{{ t('usage.sourceAll') }}</option>
          <option v-for="name in USAGE_SOURCES" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>

      <label v-if="isSuperuser" class="fieldset">
        <span class="fieldset-legend">{{ t('usage.user') }}</span>
        <select id="usage-user" v-model="userId" data-testid="usage-user" class="select select-sm" @change="load">
          <option value="">{{ t('usage.userAll') }}</option>
          <option v-for="user in users" :key="user.id" :value="user.id">{{ userLabel(user) }}</option>
        </select>
      </label>

      <button id="usage-clear" data-testid="usage-clear" class="btn btn-sm btn-ghost" @click="clearFilters">{{ t('usage.clear') }}</button>
    </div>

    <p v-if="rangeError" class="text-error text-xs" data-testid="usage-range-error">{{ t('usage.invalidRange') }}</p>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div class="stat bg-base-200/60 border-base-300 rounded-box border p-4">
        <div class="stat-title text-xs">{{ t('usage.tokens') }}</div>
        <div class="stat-value text-2xl" data-testid="usage-total-tokens">{{ formatTokens(summary.totalTokens) }}</div>
      </div>
      <div class="stat bg-base-200/60 border-base-300 rounded-box border p-4">
        <div class="stat-title text-xs">{{ t('usage.requests') }}</div>
        <div class="stat-value text-2xl" data-testid="usage-requests">{{ formatTokens(summary.requests) }}</div>
      </div>
      <div class="stat bg-base-200/60 border-base-300 rounded-box border p-4">
        <div class="stat-title text-xs">{{ t('usage.promptTokens') }}</div>
        <div class="stat-value text-2xl" data-testid="usage-prompt-tokens">{{ formatTokens(summary.promptTokens) }}</div>
      </div>
      <div class="stat bg-base-200/60 border-base-300 rounded-box border p-4">
        <div class="stat-title text-xs">{{ t('usage.completionTokens') }}</div>
        <div class="stat-value text-2xl" data-testid="usage-completion-tokens">{{ formatTokens(summary.completionTokens) }}</div>
      </div>
      <div class="stat bg-base-200/60 border-base-300 rounded-box border p-4">
        <div class="stat-title text-xs">{{ t('usage.cachedTokens') }}</div>
        <div class="stat-value text-2xl" data-testid="usage-cached-tokens">{{ formatTokens(summary.cachedTokens) }}</div>
        <div class="stat-desc text-xs" data-testid="usage-cache-hit-rate">{{ t('usage.cacheHitRate') }} {{ formatPercent(cacheHitRate) }}</div>
      </div>
    </div>

    <div class="card bg-base-200/60 border-base-300 border">
      <div class="card-body gap-3 p-4 sm:p-6">
        <h2 class="card-title text-base">
          {{ t('usage.chartTitle') }}
          <span class="text-base-content/60 text-sm font-normal">{{ formatTokens(summary.totalTokens) }}</span>
        </h2>

        <div v-if="loading" class="flex items-center justify-center" style="height: 280px">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <p v-else-if="rows.length === 0" class="text-base-content/70 py-16 text-center text-sm" data-testid="usage-empty">{{ t('usage.empty') }}</p>
        <UsageChart v-else :buckets="buckets" :prompt-label="t('usage.promptLabel')" :completion-label="t('usage.completionLabel')" :cached-label="t('usage.cachedLabel')" :height="280" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiUsageLogDto, ApiUsageQuery, ApiUserDto } from '@/api';
import { getApiKeys, getUsers, postUsage } from '@/api';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { USAGE_SOURCES } from '@/config/usageSources';
import { bucketUsage, dateInputValue, formatPercent, formatTokens, parseDateInput, rangeFor, rangeFromDates, summarize, USAGE_RANGE_PRESETS, type UsageRange, type UsageRangePreset } from '@/utils/usage';
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const UsageChart = defineAsyncComponent(() => import('@/components/UsageChart.vue'));

const { t } = useI18n();
const alertStore = useAlertStore();
const authStore = useAuthStore();
const apiError = useApiError();

const isSuperuser = computed(() => authStore.user?.is_superuser === true);

const now = new Date();
const rangePreset = ref<UsageRangePreset>('thisMonth');
const customFrom = ref(dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
const customTo = ref(dateInputValue(now));
const apiKeyName = ref('');
const source = ref('');
const userId = ref('');

const apiKeys = ref<{ name: string }[]>([]);
const users = ref<ApiUserDto[]>([]);
const rows = ref<ApiUsageLogDto[]>([]);
const loading = ref(false);

let userInitialised = false;

const rangeError = computed(() => {
  if (rangePreset.value !== 'custom') {
    return false;
  }
  const from = parseDateInput(customFrom.value);
  const to = parseDateInput(customTo.value);
  return from === undefined || to === undefined || from > to;
});

const range = computed<UsageRange | undefined>(() => {
  if (rangePreset.value !== 'custom') {
    return rangeFor(rangePreset.value);
  }
  const from = parseDateInput(customFrom.value);
  const to = parseDateInput(customTo.value);
  if (!from || !to || from > to) {
    return undefined;
  }
  return rangeFromDates(from, to);
});

const summary = computed(() => summarize(rows.value));
const cacheHitRate = computed(() => (summary.value.promptTokens === 0 ? 0 : summary.value.cachedTokens / summary.value.promptTokens));
const buckets = computed(() => (range.value ? bucketUsage(rows.value, range.value) : []));

const apiKeyNames = computed(() => [...new Set(apiKeys.value.map((key) => key.name).filter((name) => Boolean(name)))].sort());

function userLabel(user: ApiUserDto): string {
  return user.display_name || user.username || user.email || '';
}

function ensureUserDefault() {
  if (!isSuperuser.value || userInitialised) {
    return;
  }
  userInitialised = true;
  const own = authStore.user?.id;
  if (own) {
    userId.value = own;
  }
}

async function loadFilters() {
  const { data } = await getApiKeys({ query: { limit: 100, offset: 0 } });
  apiKeys.value = (data?.items ?? []) as { name: string }[];

  if (!isSuperuser.value) {
    return;
  }
  const result = await getUsers({ query: { limit: 100, offset: 0 } });
  users.value = result.data?.items ?? [];
}

async function load() {
  ensureUserDefault();

  const current = range.value;
  if (!current) {
    rows.value = [];
    return;
  }

  loading.value = true;
  const body: ApiUsageQuery = { from: current.from.toISOString(), to: current.to.toISOString() };
  if (apiKeyName.value) {
    body.api_key_name = apiKeyName.value;
  }
  if (source.value) {
    body.source = source.value;
  }
  if (isSuperuser.value && userId.value) {
    body.user_id = userId.value;
  }

  const { data, error } = await postUsage({ body });
  loading.value = false;

  if (error || !data) {
    rows.value = [];
    alertStore.addItem({ level: 'error', message: apiError(error, 'usage.loadError') });
    return;
  }

  rows.value = data;
}

function clearFilters() {
  rangePreset.value = 'thisMonth';
  customFrom.value = dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  customTo.value = dateInputValue(now);
  apiKeyName.value = '';
  source.value = '';
  userId.value = authStore.user?.id ?? '';
  userInitialised = true;
  void load();
}

onMounted(() => {
  void loadFilters();
  void load();
});
</script>
