<template>
  <div data-testid="chat-page">
    <div ref="planDock" class="fixed inset-x-0 top-12 z-30 pt-2 sm:top-14 lg:left-72 md:mx-10" data-testid="chat-plan-dock">
      <ChatPlanCard :items="chatSocket.planItems" class="shadow-md" />
    </div>
    <div id="chat-history" ref="history" class="mb-30 md:mx-10 flex flex-col" :style="historyStyle">
      <ChatMessage :messages="chatSocket.history" :busy="reverting || chatSocket.streaming" :streaming-from-seq="chatSocket.streamingFromSeq" @revert="handleRevert" />
    </div>
    <div class="chat-input-dock fixed inset-x-0 z-30 lg:left-72 md:mx-8 mb-2" data-testid="chat-input-dock">
      <div v-if="!pinned" class="pointer-events-none absolute inset-x-0 bottom-full mb-3 flex justify-end px-4">
        <ScrollToBottomButton class="pointer-events-auto" @click="scrollToBottom" />
      </div>
      <ChatInputArea
        ref="inputArea"
        :agents="chatSocket.agentNames"
        :initial-agent="chatStore.agentFor(sessionId)"
        :default-agent="chatSocket.defaultAgent"
        :providers="chatSocket.providers"
        :status="chatSocket.status"
        :streaming="chatSocket.streaming"
        @submit="handleSubmit"
        @stop="chatSocket.stop"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ChatInputArea from '@/components/Chat/ChatInputArea.vue';
import ChatMessage from '@/components/Chat/ChatMessage.vue';
import ChatPlanCard from '@/components/Chat/ChatPlanCard.vue';
import ScrollToBottomButton from '@/components/Chat/ScrollToBottomButton.vue';
import { useChatSocket } from '@/composables/useChatSocket';
import { useStickyScroll } from '@/composables/useStickyScroll';
import { useVisualViewportInsets } from '@/composables/useVisualViewportInsets';
import { useChatStore } from '@/stores/chatStore';

/** The one command the page answers itself; see handleSubmit. */
const STOP_COMMAND = '/stop';

const route = useRoute();
const sessionId = computed(() => (typeof route.params.uuid === 'string' ? route.params.uuid : undefined));
const chatSocket = useChatSocket(sessionId);
const chatStore = useChatStore();

useVisualViewportInsets();

const inputArea = ref<InstanceType<typeof ChatInputArea> | null>(null);
const planDock = ref<HTMLElement | null>(null);
const planHeight = ref(0);
const history = ref<HTMLElement | null>(null);
const reverting = ref(false);
const { pinned, scrollToBottom } = useStickyScroll(history);

const historyStyle = computed<Record<string, string>>(() => ({
  paddingTop: `${planHeight.value}px`,
  '--chat-sticky-top': `${planHeight.value}px`,
}));

let planObserver: ResizeObserver | undefined;

watch(sessionId, () => scrollToBottom());

function handleSubmit(payload: { content: string; agent: string; provider: string; images?: string[] }) {
  // `/stop` is answered here rather than sent: it ends the turn already running,
  // so a message carrying it would only queue behind the one it means to stop.
  if (payload.content === STOP_COMMAND) {
    chatSocket.stop();
    inputArea.value?.clear();
    return;
  }
  chatSocket.send(payload.content, payload.agent, payload.provider, () => inputArea.value?.clear(), payload.images ?? []);
  // Kept beside the session so the picker comes back to this agent rather than
  // the first one in the listing, both after the pending turn is flushed and
  // when the chat is reopened later in the same page load.
  if (sessionId.value) {
    chatStore.setSessionAgent(sessionId.value, payload.agent);
  }
  scrollToBottom();
}

async function handleRevert(messageId: string) {
  if (reverting.value) {
    return;
  }
  reverting.value = true;
  try {
    await chatSocket.revert(messageId);
  } finally {
    reverting.value = false;
  }
}

onMounted(async () => {
  if (planDock.value && typeof ResizeObserver !== 'undefined') {
    planObserver = new ResizeObserver((entries) => {
      // offsetHeight, not contentRect: the dock's own padding is the gap that
      // keeps the card clear of the header, and the history has to clear both.
      planHeight.value = Math.round((entries[0]?.target as HTMLElement | undefined)?.offsetHeight ?? 0);
    });
    planObserver.observe(planDock.value);
  }
  await chatSocket.load();
  const pending = chatStore.takePendingTurn(sessionId.value ?? '');
  if (pending) {
    // The turn arrives from the home page, which never showed this session: the
    // agent it was written for is the one the picker has to come up on. Taking
    // the turn clears the store's only copy, so it is recorded as the session's
    // agent before it is sent.
    chatStore.setSessionAgent(pending.sessionId, pending.agent);
    chatSocket.send(pending.content, pending.agent, pending.provider, undefined, pending.images ?? []);
  }
});

onBeforeUnmount(() => {
  planObserver?.disconnect();
});
</script>
