<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{
  click: [];
}>();

const { t } = useI18n();

const label = computed(() => t('chat.scrollToBottom'));
</script>

<template>
  <button type="button" data-testid="chat-scroll-to-bottom" class="btn btn-circle btn-sm border-base-300 bg-base-200/80 shadow-lg hover:bg-base-200" :title="label" :aria-label="label" @click="emit('click')">
    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  </button>
</template>
