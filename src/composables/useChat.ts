import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { getAgentsNames, getProvidersModels, type ApiProviderSummaryDto } from '@/api';
import { useAuthStore } from '@/stores/authStore';

export type ChatSessionId = string | null | undefined;

function chatSocketUrl(sessionId: string, token: string): string {
  const base = import.meta.env.VITE_AGENT_API_BASE_URL || '/agent-api';
  const url = new URL(`${base.replace(/\/+$/, '')}/chat/ws/${encodeURIComponent(sessionId)}`, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
}

export function useChat(sessionId: MaybeRefOrGetter<ChatSessionId>) {
  const authStore = useAuthStore();
  const agents = ref<string[]>([]);
  const providers = ref<ApiProviderSummaryDto[]>([]);
  const ws = ref<WebSocket>();

  async function load() {
    connect();
    await loadAgents();
    await loadProviders();
  }

  async function loadAgents() {
    const res = await getAgentsNames();
    if (res.data) {
      agents.value = res.data
    }
  }

  async function loadProviders() {
    const res = await getProvidersModels();
    if (res.data) {
      providers.value = res.data
    }
  }

  function disconnect() {
    ws.value?.close();
    ws.value = undefined;
  }

  function connect() {
    disconnect();
    const id = toValue(sessionId);
    const token = authStore.accessToken;
    if (!id || !token) {
      return;
    }
    ws.value = new WebSocket(chatSocketUrl(id, token));
  }

  watch(
    () => toValue(sessionId),
    () => connect(),
  );

  onScopeDispose(disconnect);

  return {
    load,
    agents,
    providers,
    ws,
    connect,
    disconnect,
  };
}
