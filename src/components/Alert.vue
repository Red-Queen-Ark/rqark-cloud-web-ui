<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="absolute right-4 bottom-4 z-50 overflow-hidden">
    <TransitionGroup name="list" tag="div">
      <template v-for="alertItem in alertStore.alertList" :key="alertItem.uuid">
        <div role="alert" :class="getAlertLevelStyle(alertItem)" class="mb-2 w-80 md:w-96">
          <AlertIcon :level="alertItem.level" class="h-6 w-6 shrink-0" />
          <span
            ><b>{{ getAlertLevelText(alertItem.level) }}</b> {{ alertItem.message }}</span
          >
        </div>
      </template>
    </TransitionGroup>
  </div>
</template>

<script lang="ts" setup>
import AlertIcon from '@/components/svg/AlertIcon.vue';
import { useAlertStore } from '@/stores/alertStore';
import { useI18n } from 'vue-i18n';
import { onMounted } from 'vue';
const alertStore = useAlertStore();
const { t } = useI18n();

function getAlertLevelStyle(alert: TAlertItem) {
  const alertStyle = `alert alert-${alert.level}`;
  return alertStyle;
}

function getAlertLevelText(level: string) {
  const map: Record<string, string> = {
    info: t('alert.info'),
    success: t('alert.success'),
    warning: t('alert.warning'),
    error: t('alert.error'),
  };
  return map[level] || '';
}

onMounted(() => {
  alertStore.clearItem();
});
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
