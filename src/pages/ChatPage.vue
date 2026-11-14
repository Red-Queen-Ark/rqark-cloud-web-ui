<template>
  <div data-testid="chat-page">
    <div ref="planDock" class="fixed inset-x-0 top-12 z-30 pt-3.5 sm:top-14 lg:left-72 md:mx-10" data-testid="chat-plan-dock">
      <ChatPlanCard :items="chatSocket.planItems" class="shadow-md" />
    </div>
    <div id="chat-history" ref="history" class="mb-30 md:mx-10 flex flex-col" :style="historyStyle">
      <ChatMessage :messages="chatSocket.history" :loading="chatSocket.loading" :busy="reverting || chatSocket.streaming" :streaming-from-seq="chatSocket.streamingFromSeq" @revert="handleRevert" />
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
        :projects="projectStore.projects"
        :project="sessionProject"
        :status="chatSocket.status"
        :streaming="chatSocket.streaming"
        @project-change="changeProject"
        @submit="handleSubmit"
        @stop="chatSocket.stop"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import ChatInputArea from '@/components/Chat/ChatInputArea.vue';
import ChatMessage from '@/components/Chat/ChatMessage.vue';
import ChatPlanCard from '@/components/Chat/ChatPlanCard.vue';
import ScrollToBottomButton from '@/components/Chat/ScrollToBottomButton.vue';
import { useApiError } from '@/composables/useApiError';
import { useChatSocket } from '@/composables/useChatSocket';
import { useStickyScroll } from '@/composables/useStickyScroll';
import { useVisualViewportInsets } from '@/composables/useVisualViewportInsets';
import { putSessionsByUuid, type ApiUpdateSessionRequest } from '@/api';
import { useAlertStore } from '@/stores/alertStore';
import { useChatStore } from '@/stores/chatStore';
import { useProjectStore } from '@/stores/projectStore';

/** The one command the page answers itself; see handleSubmit. */
const STOP_COMMAND = '/stop';

const route = useRoute();
const sessionId = computed(() => (typeof route.params.uuid === 'string' ? route.params.uuid : undefined));
const chatSocket = useChatSocket(sessionId);
const chatStore = useChatStore();
const projectStore = useProjectStore();
const alertStore = useAlertStore();
const apiError = useApiError();
const { t } = useI18n();

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

const sessionProject = computed(() => (sessionId.value ? (chatStore.sessionProjects[sessionId.value] ?? null) : null));

/**
 * Writes the project onto the session. The engine reads the stored value when
 * it builds the next turn, so this turn's directory still runs where the session
 * already was; the message says as much.
 */
async function changeProject(projectId: string | null) {
  const id = sessionId.value;
  if (!id) {
    return;
  }
  const previous = chatStore.sessionProjects[id] ?? null;
  if (previous === projectId) {
    return;
  }
  // Optimistic: the select has already moved, and an error puts it back.
  chatStore.setSessionProject(id, projectId);
  const { error } = await putSessionsByUuid({ path: { uuid: id }, body: { project_id: projectId } as ApiUpdateSessionRequest });
  if (error) {
    chatStore.setSessionProject(id, previous);
    alertStore.addItem({ level: 'error', message: apiError(error, 'projects.changeError') });
    return;
  }
  alertStore.addItem({ level: 'info', message: t('projects.changeNextTurn') });
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
  // The picker above the input needs the projects before a turn is sent; a
  // failure here leaves it offering only "no project".
  void projectStore.load();
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
