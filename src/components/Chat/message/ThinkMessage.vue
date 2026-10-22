<template>
  <details v-if="props.message.reasoning_content" class="group w-full" data-testid="think-block">
    <!--
      Reasoning is never dropped — it is what explains an otherwise strange tool
      call — but it is also the longest and least re-read part of a turn, so it
      folds into one row and stays folded until someone asks for it.
    -->
    <summary class="text-base-content/40 hover:text-base-content/60 inline-flex cursor-pointer list-none items-center gap-1 rounded px-1 py-0.5 text-xs select-none">
      <ChevronRightIcon class="h-3 w-3 transition-transform group-open:rotate-90" />
      {{ t('chat.thinking') }}
    </summary>
    <p class="text-base-content/50 mt-1 text-sm break-words whitespace-pre-wrap ps-4">{{ props.message.reasoning_content }}</p>
  </details>
</template>

<script setup lang="ts">
import ChevronRightIcon from '@/components/svg/ChevronRightIcon.vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  message: ChatAssistantMessage;
}>();

const { t } = useI18n();
</script>
