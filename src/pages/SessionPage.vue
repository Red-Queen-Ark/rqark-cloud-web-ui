<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('sessions.hint') }}</p>
    </DataToolbar>

    <DataListPanel :loading="loading" :loading-label="t('sessions.loading')" :empty="sessions.length === 0" :empty-title="t('sessions.empty')" :empty-description="t('sessions.emptyDesc')">
      <!--
        The table never wraps, so a narrow viewport scrolls it sideways instead
        of dropping cells out of sight. The actions column is pinned to that
        edge, otherwise the row button falls outside the panel whenever the rest
        of the row is wider than it.
      -->
      <div class="scrollbar-thin overflow-x-auto">
        <table class="table w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('sessions.sessionTitle') }}</th>
              <th>{{ t('sessions.planItems') }}</th>
              <th>{{ t('sessions.created') }}</th>
              <th>{{ t('sessions.updated') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('sessions.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="session in sessions" :key="session.id">
              <td class="font-medium">{{ session.title || '—' }}</td>
              <td class="text-base-content/70">{{ session.plan_items?.length ?? 0 }}</td>
              <td class="text-base-content/70">{{ formatDateTime(session.created_at) }}</td>
              <td class="text-base-content/70">{{ formatDateTime(session.updated_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <button class="btn btn-ghost btn-xs" @click="openSession(session)">{{ t('sessions.view') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DataListPanel>
  </div>
</template>

<script setup lang="ts">
import type { ApiSessionDto } from '@/api';
import { getSessions } from '@/api';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const alertStore = useAlertStore();
const apiError = useApiError();

const sessions = ref<ApiSessionDto[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  const { data, error } = await getSessions();
  loading.value = false;

  if (error || !data) {
    sessions.value = [];
    alertStore.addItem({ level: 'error', message: apiError(error, 'sessions.loadError') });
    return;
  }

  // The endpoint answers with the whole set, most recently updated first.
  sessions.value = data;
}

function openSession(session: ApiSessionDto) {
  if (!session.id) {
    return;
  }
  // `lang` is part of the parent route, so it travels with the link.
  void router.push({ name: 'sessionDetail', params: { lang: route.params.lang as string, uuid: session.id } });
}

onMounted(load);
</script>
