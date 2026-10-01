<template>
  <div data-testid="chat-page" class="space-y-4"></div>
</template>

<script setup lang="ts">
import { useChat } from '@/composables/useChat';
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// `chat/:uuid` — a route param is `string | string[]`, and only a single string
// names a session, so anything else leaves the chat disconnected.
const sessionId = computed(() => (typeof route.params.uuid === 'string' ? route.params.uuid : undefined));

const { load } = useChat(sessionId);

onMounted(load);
</script>
