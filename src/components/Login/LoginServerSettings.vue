<template>
  <button id="login-server-settings" class="btn btn-ghost btn-sm" :aria-label="t('settings.servers')" @click="open">
    <CogIcon class="h-4 w-4" />
    <span class="hidden sm:inline">{{ t('settings.servers') }}</span>
  </button>
  <ServerSettingsModal v-if="show" @close="show = false" />
</template>

<script setup lang="ts">
import ServerSettingsModal from '@/components/ServerSettingsModal.vue';
import CogIcon from '@/components/svg/CogIcon.vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const show = ref(false);

function open() {
  show.value = true;
}

defineExpose({ open });
</script>
