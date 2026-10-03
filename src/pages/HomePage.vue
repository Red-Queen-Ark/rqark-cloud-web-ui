<template>
  <div data-testid="home-page">
    <div class="pointer-events-none fixed inset-0 z-0 flex flex-col items-center justify-center gap-4 px-6 pb-24 text-center lg:left-72 opacity-60 " data-testid="home-hero">
      <img src="/logo.svg" alt="" class="h-30 w-30" />
      <div class="space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('home.welcome', { app: appName }) }}</h1>
        <p class="text-base-content/50">{{ t('home.subtitle') }}</p>
      </div>
    </div>

    <div class="chat-input-dock fixed inset-x-0 z-30 lg:left-72" data-testid="chat-input-dock">
      <ChatInputArea ref="inputArea" :agents="chatSocket.agents" :providers="chatSocket.providers" @submit="handleSubmit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { postSessions } from '@/api';
import ChatInputArea from '@/components/Chat/ChatInputArea.vue';
import { useApiError } from '@/composables/useApiError';
import { useChatSocket } from '@/composables/useChatSocket';
import { useVisualViewportInsets } from '@/composables/useVisualViewportInsets';
import { useAlertStore } from '@/stores/alertStore';
import { useChatStore } from '@/stores/chatStore';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const alertStore = useAlertStore();
const apiError = useApiError();
const chatStore = useChatStore();
const chatSocket = useChatSocket(undefined);
const appName = import.meta.env.VITE_APP_NAME || 'App';

useVisualViewportInsets();

const inputArea = ref<InstanceType<typeof ChatInputArea> | null>(null);
const starting = ref(false);

async function handleSubmit(payload: { content: string; agent: string; provider: string }) {
  if (starting.value) {
    return;
  }
  starting.value = true;
  try {
    const { data, error } = await postSessions({ body: {} });
    if (error || !data?.id) {
      alertStore.addItem({ level: 'error', message: apiError(error, 'home.startError') });
      return;
    }
    chatStore.setPendingTurn({ sessionId: data.id, ...payload });
    inputArea.value?.clear();
    await router.push({ name: 'chat', params: { lang: route.params.lang as string, uuid: data.id } });
  } finally {
    starting.value = false;
  }
}

onMounted(() => {
  chatSocket.load();
});
</script>
