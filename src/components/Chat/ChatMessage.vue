<template>
  <template v-for="(message, index) in props.messages" :key="message.data.id ?? index">
    <UserMessage v-if="message.role === 'user'" :message="message.data" :revertible="revertible(message)" :busy="props.busy" class="px-4 py-2" @revert="emit('revert', $event)" />
    <template v-else-if="message.role === 'assistant'">
      <ThinkMessage :message="message.data" class="px-4 pb-2" />
      <AssistantMessage :message="message.data" class="px-4 pb-2" />
      <ToolMessage :message="message.data" :tool-result="toolResult" class="px-4" />
      <div v-if="message.data.created_at" class="flex items-center justify-start gap-1.5 px-4 pb-2">
        <p data-testid="assistant-message-time" class="text-base-content/40 text-xs pr-1">{{ formatDateTime(message.data.created_at) }}</p>
        <button v-if="message.data.content" type="button" data-testid="assistant-message-copy" class="btn btn-ghost btn-square btn-xs text-success" :title="t('chat.copy')" :aria-label="t('chat.copy')" @click="copy(message.data.content)">
          <CopyIcon class="h-3.5 w-3.5" />
        </button>
      </div>
    </template>
  </template>
</template>

<script setup lang="ts">
import CopyIcon from '@/components/svg/CopyIcon.vue';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import UserMessage from './message/UserMessage.vue';
import ThinkMessage from './message/ThinkMessage.vue';
import AssistantMessage from './message/AssistantMessage.vue';
import ToolMessage from './message/ToolMessage.vue';

const props = defineProps<{
  messages: ChatHistoryEntry[];
  busy?: boolean;
}>();

const emit = defineEmits<{ revert: [messageId: string] }>();

const { t } = useI18n();
const alertStore = useAlertStore();

async function copy(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    alertStore.addItem({ level: 'success', message: t('chat.copied') });
  } catch {
    alertStore.addItem({ level: 'error', message: t('chat.copyError') });
  }
}

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
