<template>
  <template v-for="(turn, index) in turns" :key="turn.key">
    <UserMessage v-if="turn.user" :message="turn.user.data" :revertible="revertible(turn.user)" :busy="props.busy" class="px-4 py-2" @revert="emit('revert', $event)" />
    <TurnGroup v-if="turn.entries.length" :entries="turn.entries" :tool-result="toolResult" :started-at="turn.user?.created_at" :streaming="Boolean(props.busy) && index === turns.length - 1" class="px-4 pb-2" />
  </template>
</template>

<script setup lang="ts">
import TurnGroup from '@/components/Chat/TurnGroup.vue';
import UserMessage from '@/components/Chat/message/UserMessage.vue';
import { computed } from 'vue';

const props = defineProps<{
  messages: ChatHistoryEntry[];
  busy?: boolean;
}>();

const emit = defineEmits<{ revert: [messageId: string] }>();

type UserEntry = Extract<ChatHistoryEntry, { role: 'user' }>;

interface Turn {
  key: string;
  user?: UserEntry;
  /** Assistant and tool entries, in arrival order. */
  entries: ChatHistoryEntry[];
}

const turns = computed<Turn[]>(() => {
  const grouped: Turn[] = [];
  let current: Turn | null = null;

  for (const entry of props.messages) {
    if (entry.role === 'user') {
      current = { key: `turn-user-${entry.data.id ?? entry.seq}`, user: entry, entries: [] };
      grouped.push(current);
      continue;
    }
    if (entry.role !== 'assistant' && entry.role !== 'tool') {
      // A system or summary row is not part of a turn; it is left out here just
      // as it was before turns were grouped.
      continue;
    }
    if (!current) {
      current = { key: `turn-open-${entry.seq}`, entries: [] };
      grouped.push(current);
    }
    current.entries.push(entry);
  }

  return grouped;
});

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
