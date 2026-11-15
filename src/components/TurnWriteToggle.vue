<template>
  <label class="flex cursor-pointer items-center gap-1" :class="busy || !config.loaded ? 'opacity-60' : ''">
    <span class="text-base-content/70 text-xs" :title="t(HINTS[setting])">{{ t(LABELS[setting]) }}</span>
    <input type="checkbox" class="toggle toggle-primary toggle-xs" :checked="enabled" :disabled="busy || !config.loaded" :aria-label="t(LABELS[setting])" :data-testid="`turn-write-toggle-${setting}`" @change="flip" />
  </label>
</template>

<script setup lang="ts">
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { useUserConfigStore } from '@/stores/userConfigStore';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

type TurnWriteSetting = 'eventLog' | 'stateUpdate';

const props = defineProps<{ setting: TurnWriteSetting }>();

const LABELS = { eventLog: 'memory.autoEventLog', stateUpdate: 'agentState.autoUpdate' } as const;
const HINTS = { eventLog: 'memory.autoEventLogHint', stateUpdate: 'agentState.autoUpdateHint' } as const;
const ERRORS = { eventLog: 'memory.toggleError', stateUpdate: 'agentState.toggleError' } as const;

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();
const config = useUserConfigStore();
const busy = ref(false);

const enabled = computed(() => config[props.setting]);

async function flip(event: Event) {
  const input = event.target as HTMLInputElement;
  const wanted = input.checked;
  busy.value = true;
  const error = props.setting === 'eventLog' ? await config.saveEventLog(wanted) : await config.saveStateUpdate(wanted);
  busy.value = false;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, ERRORS[props.setting]) });
  }
  input.checked = enabled.value;
}
</script>
