<template>
  <template v-for="(message, index) in props.messages" :key="index">
    <UserMessage v-if="message.role === 'user'" :message="message.data" class="self-end" />
    <template v-else-if="message.role === 'assistant'">
      <ThinkMessage :message="message.data" />
      <AssistantMessage :message="message.data" />
      <ToolMessage :message="message.data" :tool-result="toolResult" />
    </template>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UserMessage from './message/UserMessage.vue';
import ThinkMessage from './message/ThinkMessage.vue';
import AssistantMessage from './message/AssistantMessage.vue';
import ToolMessage from './message/ToolMessage.vue';

const props = defineProps<{
  messages: ChatHistoryEntry[];
}>();

const toolResult = computed<Record<string, ChatToolMessage>>(() => {
  const res: Record<string, ChatToolMessage> = {};
  for (const msg of props.messages) {
    if (msg.role === 'tool') {
      res[msg.data.tool_call_id] = msg.data
    }
  }
  return res;
});
</script>
