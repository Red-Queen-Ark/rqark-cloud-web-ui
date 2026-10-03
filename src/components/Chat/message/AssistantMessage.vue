<template>
  <div v-if="props.message.content" class="max-w-[90%] px-4 py-2">
    <MessageBody :html="renderMarkdown(props.message.content)" :raw="props.message.content" />
  </div>
</template>

<script setup lang="ts">
import MessageBody from '@/components/Session/MessageBody.vue';
import { renderMarkdown } from '@/utils/markdown';

const props = defineProps<{
  message: ChatAssistantMessage;
}>();
</script>
