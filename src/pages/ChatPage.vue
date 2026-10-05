<template>
  <div data-testid="chat-page">
    <div ref="planDock" class="fixed inset-x-0 top-12 z-30 sm:top-14 lg:left-72 md:mx-10" data-testid="chat-plan-dock">
      <ChatPlanCard :items="chatSocket.planItems" class="shadow-md" />
    </div>
    <div id="chat-history" class="mb-30 md:mx-10 flex flex-col" :style="{ paddingTop: `${planHeight}px` }">
      <ChatMessage :messages="chatSocket.history" />
    </div>
    <div class="chat-input-dock fixed inset-x-0 z-30 lg:left-72 md:mx-8 mb-2" data-testid="chat-input-dock">
      <ChatInputArea ref="inputArea" :agents="chatSocket.agents" :providers="chatSocket.providers" :status="chatSocket.status" :streaming="chatSocket.streaming" @submit="handleSubmit" @stop="chatSocket.stop" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import ChatInputArea from '@/components/Chat/ChatInputArea.vue';
import ChatMessage from '@/components/Chat/ChatMessage.vue';
import ChatPlanCard from '@/components/Chat/ChatPlanCard.vue';
import { useChatSocket } from '@/composables/useChatSocket';
import { useVisualViewportInsets } from '@/composables/useVisualViewportInsets';
import { useChatStore } from '@/stores/chatStore';

const route = useRoute();
const sessionId = computed(() => (typeof route.params.uuid === 'string' ? route.params.uuid : undefined));
const chatSocket = useChatSocket(sessionId);
const chatStore = useChatStore();

useVisualViewportInsets();

const inputArea = ref<InstanceType<typeof ChatInputArea> | null>(null);
const planDock = ref<HTMLElement | null>(null);
const planHeight = ref(0);

let planObserver: ResizeObserver | undefined;

function handleSubmit(payload: { content: string; agent: string; provider: string }) {
  chatSocket.send(payload.content, payload.agent, payload.provider, () => inputArea.value?.clear());
}

onMounted(async () => {
  if (planDock.value && typeof ResizeObserver !== 'undefined') {
    planObserver = new ResizeObserver((entries) => {
      planHeight.value = Math.round(entries[0]?.contentRect.height ?? 0);
    });
    planObserver.observe(planDock.value);
  }
  await chatSocket.load();
  const pending = chatStore.takePendingTurn(sessionId.value ?? '');
  if (pending) {
    chatSocket.send(pending.content, pending.agent, pending.provider);
  }
});

onBeforeUnmount(() => {
  planObserver?.disconnect();
});
</script>
