import { onScopeDispose, reactive, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { getAgentsNames, getProvidersModels, getSessionsByUuidMessages, type ApiProviderSummaryDto, type ApiSessionMessageDto } from '@/api';
import { useAuthStore } from '@/stores/authStore';

export type ChatSessionId = string | null | undefined;

export function useChatSocket(sessionId: MaybeRefOrGetter<ChatSessionId>) {
  const authStore = useAuthStore();
  const agents = ref<string[]>([]);
  const providers = ref<ApiProviderSummaryDto[]>([]);
  const ws = ref<WebSocket>();
  const status = ref<string>('Waiting');
  const history = ref<ApiSessionMessageDto[]>([]);

  async function load() {
    connect();
    await loadAgents();
    await loadProviders();
    await loadHistory();
  }

  async function loadAgents() {
    const res = await getAgentsNames();
    if (res.data) {
      agents.value = res.data;
    }
  }

  async function loadProviders() {
    const res = await getProvidersModels();
    if (res.data) {
      providers.value = res.data;
    }
  }

  async function loadHistory() {
    const id = toValue(sessionId);
    if (!id) {
      history.value = [];
      return;
    }
    const res = await getSessionsByUuidMessages({ path: { uuid: id } });
    if (res.data) {
      history.value = res.data;
    }
  }

  function chatSocketUrl(sessionId: string, token: string): string {
    const base = import.meta.env.VITE_AGENT_API_BASE_URL || '/agent-api';
    const url = new URL(`${base.replace(/\/+$/, '')}/chat/ws/${encodeURIComponent(sessionId)}`, window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', token);
    return url.toString();
  }

  function connect() {
    disconnect();
    const id = toValue(sessionId);
    const token = authStore.accessToken;
    if (!id || !token) {
      return;
    }
    ws.value = new WebSocket(chatSocketUrl(id, token));
    ws.value.onopen = () => {
      status.value = 'Connected';
    };
    // eslint-disable-next-line no-console
    ws.value.onmessage = (event) => console.log(event);
  }

  function disconnect() {
    ws.value?.close();
    ws.value = undefined;
  }

  watch(
    () => toValue(sessionId),
    () => connect(),
  );

  function send(content: string, agent: string, provider: string) {
    const data = JSON.stringify({ content, provider, agent });
    ws.value?.send(data);
  }

  onScopeDispose(disconnect);

  return reactive({
    load,
    agents,
    providers,
    status,
    ws,
    history,
    connect,
    disconnect,
    send,
  });
}
