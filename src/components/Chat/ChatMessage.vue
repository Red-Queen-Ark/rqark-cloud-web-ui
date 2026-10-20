<template>
  <template v-for="(message, index) in props.messages" :key="message.data.id ?? index">
    <UserMessage v-if="message.role === 'user'" :message="message.data" :revertible="revertible(message)" :busy="props.busy" class="px-4 py-2" @revert="emit('revert', $event)" />
    <template v-else-if="message.role === 'assistant'">
      <ThinkMessage :message="message.data" class="px-4 py-1" />
      <AssistantMessage :message="message.data" class="px-4 py-1" />
      <ToolMessage :message="message.data" :tool-result="toolResult" class="px-4 py-1" />
      <div v-if="message.data.created_at" class="px-4">
        <span data-testid="assistant-message-time" class="text-base-content/40 text-xs">{{ formatDateTime(message.data.created_at) }}</span>
      </div>
    </template>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatDateTime } from '@/utils/datetime';
import UserMessage from './message/UserMessage.vue';
import ThinkMessage from './message/ThinkMessage.vue';
import AssistantMessage from './message/AssistantMessage.vue';
import ToolMessage from './message/ToolMessage.vue';

const props = defineProps<{
  messages: ChatHistoryEntry[];
  busy?: boolean;
}>();

const emit = defineEmits<{ revert: [messageId: string] }>();

const openingTurn = computed(() => props.messages.find((message) => message.role === 'user'));

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
  // Reverting trims the session back to before the message, so the opening turn
  // would wipe the whole chat; only a later user turn may be reverted.
  return message.role === 'user' && message !== openingTurn.value && Boolean(message.data.id);
}
</script>
