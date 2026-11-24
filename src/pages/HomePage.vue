<template>
  <div data-testid="home-page">
    <div class="pointer-events-none fixed inset-0 z-0 flex flex-col items-center justify-center gap-4 px-6 pb-24 text-center lg:left-72 opacity-60" data-testid="home-hero">
      <img src="/logo.svg" alt="" class="h-30 w-30" />
      <div class="space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('home.welcome', { app: appName }) }}</h1>
        <p class="text-base-content/50">{{ t('home.subtitle') }}</p>
      </div>
    </div>
    <div class="chat-input-dock fixed inset-x-0 z-30 lg:left-72 md:mx-8 mb-2" data-testid="chat-input-dock">
      <ChatInputArea
        ref="inputArea"
        :agents="chatSocket.agentNames"
        :default-agent="chatSocket.defaultAgent"
        :providers="chatSocket.providers"
        :projects="projectStore.sorted"
        :project="presetProject"
        :status="pingStatus"
        @submit="handleSubmit"
        @content-change="saveDraft"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { postSessions } from '@/api';
import ChatInputArea from '@/components/Chat/ChatInputArea.vue';
import { useApiError } from '@/composables/useApiError';
import { useChatSocket } from '@/composables/useChatSocket';
import { usePingStatus } from '@/composables/usePingStatus';
import { useVisualViewportInsets } from '@/composables/useVisualViewportInsets';
import { SESSION_SOURCE } from '@/config/sessionSource';
import { useAlertStore } from '@/stores/alertStore';
import { NEW_SESSION_DRAFT_KEY, useChatStore } from '@/stores/chatStore';
import { useProjectStore } from '@/stores/projectStore';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const alertStore = useAlertStore();
const apiError = useApiError();
const chatStore = useChatStore();
const projectStore = useProjectStore();
const chatSocket = useChatSocket(undefined);
const { status: pingStatus } = usePingStatus();
const appName = import.meta.env.VITE_APP_NAME || 'App';

useVisualViewportInsets();

/**
 * The project a `?project=` link asked for, which is how a project's own "new
 * session" entry reaches this page. An id the user does not have resolves to no
 * project rather than to an empty picker.
 */
const presetProject = computed(() => {
  const id = route.query.project;
  if (typeof id !== 'string' || !id) {
    return null;
  }
  return projectStore.projects.some((project) => project.id === id) ? id : null;
});

const inputArea = ref<InstanceType<typeof ChatInputArea> | null>(null);
const starting = ref(false);

function saveDraft(text: string) {
  chatStore.setDraft(NEW_SESSION_DRAFT_KEY, text);
}

function restoreDraft() {
  inputArea.value?.setText(chatStore.sessionDrafts[NEW_SESSION_DRAFT_KEY] ?? '');
}

async function handleSubmit(payload: { content: string; agent: string; provider: string; images?: string[]; project?: string | null }) {
  if (starting.value) {
    return;
  }
  starting.value = true;
  try {
    // The project is written on the session at creation, so the first turn
    // already runs in it: the engine reads the stored value, not the turn.
    const { data, error } = await postSessions({ body: { source: SESSION_SOURCE, project_id: payload.project ?? undefined } });
    if (error || !data?.id) {
      alertStore.addItem({ level: 'error', message: apiError(error, 'home.startError') });
      return;
    }
    chatStore.setPendingTurn({ sessionId: data.id, ...payload });
    inputArea.value?.clear();
    chatStore.clearDraft(NEW_SESSION_DRAFT_KEY);
    await router.push({ name: 'chat', params: { lang: route.params.lang as string, uuid: data.id } });
  } finally {
    starting.value = false;
  }
}

onMounted(() => {
  restoreDraft();
  chatSocket.load();
  // The picker above the input needs the list before the first message; a
  // failure here just leaves it offering only "no project".
  void projectStore.load();
});
</script>
