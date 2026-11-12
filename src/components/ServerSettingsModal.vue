<template>
  <div class="modal modal-open">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold">{{ t('settings.servers') }}</h3>

      <ServerSettings />

      <div class="modal-action">
        <button id="server-settings-close" class="btn btn-sm" @click="emit('close')">{{ t('common.close') }}</button>
      </div>
    </div>
    <label class="modal-backdrop" @click="emit('close')"></label>
  </div>
</template>

<script setup lang="ts">
import ServerSettings from '@/components/ServerSettings.vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
</script>
