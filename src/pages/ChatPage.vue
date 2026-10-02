<template>
  <div data-testid="chat-page" class="space-y-4 flex flex-col ">
    <button class="btn btn-primary " @click="chat">Test</button>
    <input class="input" type="text" />
    <p>{{ chatSocket.status }}</p>
    <p>{{ chatSocket.agents }}</p>
    <p>{{ chatSocket.providers }}</p>
  </div>
</template>

<script setup lang="ts">
import { useChatSocket } from '@/composables/useChatSocket';
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const sessionId = computed(() => (typeof route.params.uuid === 'string' ? route.params.uuid : undefined));
const chatSocket = useChatSocket(sessionId);

async function chat() {
  chatSocket.send('你係邊個', 'Wednesday', 'mimo-v2.5-pro')
}

onMounted( () => {
  chatSocket.load()
});
</script>
