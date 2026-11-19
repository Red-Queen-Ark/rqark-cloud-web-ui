<template>
  <!--
    A summary is not part of a turn: it stands where the conversation was
    compressed, so it keeps its own frame and label instead of folding into the
    answer around it.
  -->
  <div data-testid="summary-message" class="border-base-300/70 bg-base-200/30 rounded-box border border-dashed">
    <div data-testid="summary-label" class="text-base-content/50 flex items-center gap-1.5 px-3 pt-2 text-xs font-medium tracking-wide uppercase select-none">
      <span aria-hidden="true">—</span>
      {{ t('chat.summary') }}
      <span aria-hidden="true">—</span>
    </div>
    <div class="text-base-content/70 px-3 pt-1 pb-2 text-sm">
      <MessageBody :html="renderMarkdown(props.message.content)" :raw="props.message.content" />
    </div>
  </div>
</template>

<script setup lang="ts">
import MessageBody from '@/components/Session/MessageBody.vue';
import { renderMarkdown } from '@/utils/markdown';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  message: ChatSummaryMessage;
}>();

const { t } = useI18n();
</script>
