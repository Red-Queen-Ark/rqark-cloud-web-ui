<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('memory.hint') }}</p>
      <template #actions>
        <TurnWriteToggle setting="eventLog" />
      </template>
    </DataToolbar>

    <DataListPanel :loading="loading" :loading-label="t('memory.loading')" :empty="agents.length === 0" :empty-title="t('memory.empty')" :empty-description="t('memory.emptyDesc')">
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('memory.agent') }}</th>
              <th>{{ t('memory.description') }}</th>
              <th>{{ t('memory.created') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('memory.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="agent in agents" :key="agent.id" :data-testid="`memory-agent-row-${agent.id}`">
              <td class="font-medium">
                <div class="flex items-center gap-1">
                  <span>{{ agent.name }}</span>
                  <span v-if="agent.is_public" class="badge badge-primary badge-xs">{{ t('agents.public') }}</span>
                </div>
              </td>
              <td class="text-base-content/70 max-w-xs truncate">{{ agent.description || '—' }}</td>
              <td class="text-base-content/70">{{ formatDateTime(agent.created_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <RouterLink class="btn btn-ghost btn-xs" :data-testid="`memory-agent-open-${agent.id}`" :to="{ name: 'memoryDetail', params: { lang: route.params.lang, uuid: agent.id } }">
                  {{ t('memory.view') }}
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DataListPanel>
  </div>
</template>

<script setup lang="ts">
import type { ApiAgentDto } from '@/api';
import { getAgents } from '@/api';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import TurnWriteToggle from '@/components/TurnWriteToggle.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
const alertStore = useAlertStore();
const apiError = useApiError();

const agents = ref<ApiAgentDto[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  const result = await getAgents();
  loading.value = false;

  if (result.error || !result.data) {
    agents.value = [];
    alertStore.addItem({ level: 'error', message: apiError(result.error, 'memory.loadError') });
    return;
  }

  agents.value = result.data;
}

onMounted(load);
</script>
