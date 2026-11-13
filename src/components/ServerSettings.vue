<template>
  <div class="space-y-3">
    <label class="fieldset w-full">
      <span class="fieldset-legend">{{ t('settings.apiBaseUrl') }}</span>
      <input id="settings-api-base" v-model.trim="apiBaseUrl" type="url" class="input w-full max-w-md" placeholder="http://localhost:7302/api" />
    </label>

    <label class="fieldset w-full">
      <span class="fieldset-legend">{{ t('settings.agentApiBaseUrl') }}</span>
      <input id="settings-agent-api-base" v-model.trim="agentApiBaseUrl" type="url" class="input w-full max-w-md" placeholder="http://localhost:8000/api" />
    </label>

    <div class="card-actions">
      <button id="settings-servers-save" class="btn btn-primary btn-sm" @click="save">{{ t('settings.save') }}</button>
    </div>

    <p class="text-base-content/60 mt-auto text-xs">{{ t('settings.serversHint') }}</p>
  </div>
</template>

<script setup lang="ts">
import { applyApiBaseUrl } from '@/api-client/runtime';
import { saveServerConfig, serverConfig } from '@/config/runtime';
import { useAlertStore } from '@/stores/alertStore';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const alertStore = useAlertStore();

const apiBaseUrl = ref('');
const agentApiBaseUrl = ref('');

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value);
}

/**
 * Saves the backends and points the API client at the new one.
 *
 * The client caches its base URL, so without the reset every later call would
 * still go to the old address.
 */
async function save(): Promise<void> {
  if (!isHttpUrl(apiBaseUrl.value) || !isHttpUrl(agentApiBaseUrl.value)) {
    alertStore.addItem({ level: 'error', message: t('settings.serverUrlInvalid') });
    return;
  }
  await saveServerConfig({ apiBaseUrl: apiBaseUrl.value, agentApiBaseUrl: agentApiBaseUrl.value });
  applyApiBaseUrl();
  alertStore.addItem({ level: 'success', message: t('settings.serversSaved') });
}

onMounted(() => {
  const servers = serverConfig();
  apiBaseUrl.value = servers.apiBaseUrl;
  agentApiBaseUrl.value = servers.agentApiBaseUrl;
});
</script>
