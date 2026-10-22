<template>
  <div class="w-full">
    <!--
      One turn reads as one thing: what the agent did folded away, what it
      answered always in view. The fold is opened while the turn is the one still
      streaming, so activity is visible as it happens, and closed once it lands —
      unless the reader opened it themselves.
    -->
    <details v-if="hasActivity" :open="open" class="group mb-1" :data-testid="`turn-activity-${anchor}`" @toggle="touched = true">
      <summary class="text-base-content/50 hover:text-base-content/70 inline-flex cursor-pointer list-none items-center gap-1.5 rounded px-1 py-0.5 text-xs select-none">
        <ChevronRightIcon class="h-3 w-3 transition-transform group-open:rotate-90" />
        <span v-if="durationLabel" data-testid="turn-duration">{{ t('chat.workedFor', { duration: durationLabel }) }}</span>
        <span v-if="durationLabel && toolCount > 0" aria-hidden="true">·</span>
        <span v-if="toolCount > 0" data-testid="turn-tool-count">{{ t(toolCount === 1 ? 'chat.toolCountOne' : 'chat.toolCount', { count: toolCount }) }}</span>
        <span v-if="!durationLabel && toolCount === 0">{{ t('chat.details') }}</span>
      </summary>

      <div class="border-base-300/60 mt-1 space-y-1 border-s-2 ps-3">
        <ThinkMessage v-for="entry in thinkingEntries" :key="`think-${entry.seq}`" :message="entry.data" class="px-4 py-1" />
        <ToolMessage v-for="entry in toolEntries" :key="`tools-${entry.seq}`" :message="entry.data" :tool-result="props.toolResult" class="px-4 py-1" />
      </div>
    </details>

    <AssistantMessage :message="answerMessage" class="px-4 py-1" />

    <div class="flex items-center justify-start gap-1.5 px-4">
      <p v-if="endedAt" data-testid="assistant-message-time" class="text-base-content/40 pr-1 text-xs">{{ formatDateTime(endedAt) }}</p>
      <button v-if="answer" type="button" data-testid="assistant-message-copy" class="btn btn-ghost btn-square btn-xs text-success" :title="t('chat.copy')" :aria-label="t('chat.copy')" @click="copyAnswer">
        <CopyIcon class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import AssistantMessage from '@/components/Chat/message/AssistantMessage.vue';
import ThinkMessage from '@/components/Chat/message/ThinkMessage.vue';
import ToolMessage from '@/components/Chat/message/ToolMessage.vue';
import CopyIcon from '@/components/svg/CopyIcon.vue';
import ChevronRightIcon from '@/components/svg/ChevronRightIcon.vue';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

type AssistantEntry = Extract<ChatHistoryEntry, { role: 'assistant' }>;

const props = defineProps<{
  /** The assistant and tool entries of one turn, in arrival order. */
  entries: ChatHistoryEntry[];
  toolResult: Record<string, ChatToolMessage>;
  /** The user message that opened the turn, when there is one; its time is the turn's start. */
  startedAt?: string;
  /** True while this is the turn still being written. */
  streaming?: boolean;
}>();

const { t } = useI18n();
const alertStore = useAlertStore();

const touched = ref(false);
const open = ref(false);

const assistantEntries = computed(() => props.entries.filter((entry): entry is AssistantEntry => entry.role === 'assistant'));

/** Reasoning is always drawn, folded inside its own block, for turns that produced some. */
const thinkingEntries = computed(() => assistantEntries.value.filter((entry) => entry.data.reasoning_content));

const toolEntries = computed(() => assistantEntries.value.filter((entry) => entry.data.tool_calls?.length));

const toolCount = computed(() => assistantEntries.value.reduce((total, entry) => total + (entry.data.tool_calls?.length ?? 0), 0));

const hasActivity = computed(() => thinkingEntries.value.length > 0 || toolEntries.value.length > 0);

/** Every answer line of the turn, in order: intermediate chatter and the final reply read as one. */
const answer = computed(() =>
  assistantEntries.value
    .map((entry) => entry.data.content)
    .filter((content) => content)
    .join('\n\n'),
);

const answerMessage = computed<ChatAssistantMessage>(() => ({
  role: 'assistant',
  content: answer.value,
  created_at: assistantEntries.value[assistantEntries.value.length - 1]?.created_at ?? '',
}));

const endedAt = computed(() => assistantEntries.value[assistantEntries.value.length - 1]?.created_at ?? '');

const anchor = computed(() => props.entries[0]?.seq ?? 0);

/** Elapsed time of the turn, or '' when either end is unknown. */
const durationLabel = computed(() => {
  const start = Date.parse(props.startedAt ?? '');
  const end = Date.parse(endedAt.value);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return '';
  }
  const seconds = (end - start) / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
});

watch(
  () => props.streaming,
  (streaming) => {
    if (!touched.value) {
      open.value = Boolean(streaming);
    }
  },
  { immediate: true },
);

async function copyAnswer() {
  try {
    await navigator.clipboard.writeText(answer.value);
    alertStore.addItem({ level: 'success', message: t('chat.copied') });
  } catch {
    alertStore.addItem({ level: 'error', message: t('chat.copyError') });
  }
}
</script>
