<template>
  <template v-for="(message, index) in props.messages" :key="index">
    <UserMessage v-if="message.role === 'user'" :message="message.data" :revertible="revertible(message)" :busy="props.busy" class="self-end px-4 py-2" @revert="emit('revert', $event)" />
    <template v-else-if="message.role === 'assistant'">
      <ThinkMessage :message="message.data" class="px-4 py-1" />
      <AssistantMessage :message="message.data" class="px-4 py-1" />
      <ToolMessage :message="message.data" :tool-result="toolResult" class="px-4 py-1" />
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
  busy?: boolean;
}>();

const emit = defineEmits<{ revert: [messageId: string] }>();

const userCount = computed(() => props.messages.filter((message) => message.role === 'user').length);

const toolResult = computed<Record<string, ChatToolMessage>>(() => {
  const res: Record<string, ChatToolMessage> = {};
  for (const msg of props.messages) {
    if (msg.role === 'tool') {
      res[msg.data.tool_call_id] = msg.data;
    }
  }
  return res;
});

function revertible(message: ChatHistoryEntry): boolean {
  return message.role === 'user' && userCount.value > 1 && Boolean(message.data.id);
}
</script>
