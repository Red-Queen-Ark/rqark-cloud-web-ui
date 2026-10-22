<template>
  <details v-if="props.message.reasoning_content" class="collapse collapse-arrow w-full" data-testid="think-block">
    <!--
      Reasoning is never dropped — it is what explains an otherwise strange tool
      call — but it is also the longest and least re-read part of a turn, so it
      folds into one row and stays folded until someone asks for it.
    -->
    <summary class="collapse-title text-base-content/40 hover:text-base-content/60 min-h-0 pe-8 ps-1 py-1 text-xs font-normal select-none">
      {{ t('chat.thinking') }}
    </summary>
    <div class="collapse-content text-base-content/50 px-1 text-sm">
      <p class="break-words whitespace-pre-wrap">{{ props.message.reasoning_content }}</p>
    </div>
  </details>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  message: ChatAssistantMessage;
}>();

const { t } = useI18n();
</script>
