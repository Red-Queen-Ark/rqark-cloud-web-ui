<template>
  <div data-testid="chat-page" class="space-y-4 flex flex-col">
    <ChatInputArea ref="inputArea" :agents="chatSocket.agents" :providers="chatSocket.providers" @submit="handleSubmit" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import ChatInputArea from '@/components/Chat/ChatInputArea.vue';
import { useChatSocket } from '@/composables/useChatSocket';

const route = useRoute();
const sessionId = computed(() => (typeof route.params.uuid === 'string' ? route.params.uuid : undefined));
const chatSocket = useChatSocket(sessionId);

const inputArea = ref<InstanceType<typeof ChatInputArea> | null>(null);

function handleSubmit(payload: { content: string; agent: string; provider: string }) {
  chatSocket.send(payload.content, payload.agent, payload.provider);
  inputArea.value?.clear();
}

onMounted(() => {
  chatSocket.load();
});
</script>
