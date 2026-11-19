<template>
  <div v-if="loading" data-testid="chat-loading" class="flex w-full flex-1 flex-col items-center justify-center px-4 py-20 text-center opacity-60" :aria-label="t('chat.loading')">
    <span class="loading loading-spinner loading-xl text-primary"></span>
  </div>
  <template v-else>
    <template v-for="block in blocks" :key="block.key">
      <SummaryMessage v-if="block.summary" :message="block.summary.data" class="px-4 py-2" />
      <template v-else-if="block.turn">
        <UserMessage v-if="block.turn.user" :message="block.turn.user.data" :revertible="revertible(block.turn.user)" :busy="props.busy" class="px-4 py-2" @revert="emit('revert', $event)" />
        <TurnGroup v-if="block.turn.entries.length" :entries="block.turn.entries" :tool-result="toolResult" :started-at="block.turn.user?.created_at" :streaming="isStreaming(block.turn)" class="px-4 pb-2" />
      </template>
    </template>
  </template>
</template>

<script setup lang="ts">
import TurnGroup from '@/components/Chat/TurnGroup.vue';
import SummaryMessage from '@/components/Chat/message/SummaryMessage.vue';
import UserMessage from '@/components/Chat/message/UserMessage.vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  messages: ChatHistoryEntry[];
  busy?: boolean;
  /** The session's history is still being read; the transcript is held back until it lands. */
  loading?: boolean;
  /** The seq the turn being written starts at; null while that turn is still unsent, undefined when the socket names none. */
  streamingFromSeq?: number | null;
}>();

const emit = defineEmits<{ revert: [messageId: string] }>();

type UserEntry = Extract<ChatHistoryEntry, { role: 'user' }>;
type SummaryEntry = Extract<ChatHistoryEntry, { role: 'summary' }>;

interface Turn {
  key: string;
  user?: UserEntry;
  /** Assistant and tool entries, in arrival order. */
  entries: ChatHistoryEntry[];
}

/**
 * One row of the transcript: a turn, or a summary standing between turns.
 *
 * A summary is a boundary rather than part of a turn, so it gets a row of its
 * own and the entries after it open a new turn.
 */
interface Block {
  key: string;
  turn?: Turn;
  summary?: SummaryEntry;
}

const blocks = computed<Block[]>(() => {
  const grouped: Block[] = [];
  let current: Turn | null = null;

  for (const entry of props.messages) {
    if (entry.role === 'summary') {
      grouped.push({ key: `summary-${entry.seq}`, summary: entry });
      current = null;
      continue;
    }
    if (entry.role === 'user') {
      current = { key: `turn-user-${entry.data.id ?? entry.seq}`, user: entry, entries: [] };
      grouped.push({ key: current.key, turn: current });
      continue;
    }
    if (entry.role !== 'assistant' && entry.role !== 'tool') {
      // A system row is not part of a turn; it is left out here just as it was
      // before turns were grouped.
      continue;
    }
    if (!current) {
      current = { key: `turn-open-${entry.seq}`, entries: [] };
      grouped.push({ key: current.key, turn: current });
    }
    current.entries.push(entry);
  }

  return grouped;
});

const lastTurn = computed<Turn | undefined>(() => [...blocks.value].reverse().find((block) => block.turn)?.turn);

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

function isStreaming(turn: Turn): boolean {
  if (!props.busy) {
    return false;
  }
  if (props.streamingFromSeq === null) {
    return false;
  }
  if (props.streamingFromSeq !== undefined) {
    return turn.user?.seq === props.streamingFromSeq || turn.entries.some((entry) => entry.seq === props.streamingFromSeq);
  }
  return turn === lastTurn.value;
}
</script>
