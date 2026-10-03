import { onScopeDispose, reactive, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { getAgentsNames, getProvidersModels, getSessionsByUuidMessages, type ApiProviderSummaryDto } from '@/api';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { applyChatPayload, chatPayloadError, openChatStream } from '@/utils/chatStream';

export type ChatSessionId = string | null | undefined;

export function useChatSocket(sessionId: MaybeRefOrGetter<ChatSessionId>) {
  const authStore = useAuthStore();
  const alertStore = useAlertStore();
  const agents = ref<string[]>([]);
  const providers = ref<ApiProviderSummaryDto[]>([]);
  const ws = ref<WebSocket>();
  const status = ref<string>('Waiting');
  const history = ref<ChatHistoryEntry[]>([]);
  let stream = openChatStream();

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
      replace([]);
      return;
    }
    const res = await getSessionsByUuidMessages({ path: { uuid: id } });
    if (res.data) {
      replace(res.data as unknown as ChatHistoryEntry[]);
    }
  }

  function replace(messages: ChatHistoryEntry[]) {
    stream = openChatStream(messages);
    history.value = stream.messages;
  }

  function receive(data: string) {
    let envelope: ChatEnvelope;
    try {
      envelope = JSON.parse(data) as ChatEnvelope;
    } catch {
      return;
    }
    const error = chatPayloadError(envelope.payload);
    if (error) {
      alertStore.addItem({ level: 'error', message: error });
      return;
    }
    stream = applyChatPayload(stream, envelope.agent_id, envelope.payload);
    history.value = stream.messages;
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
    const socket = new WebSocket(chatSocketUrl(id, token));
    socket.onopen = () => {
      status.value = 'Connected';
    };
    socket.onclose = () => {
      status.value = 'Disconnected';
      if (ws.value === socket) {
        ws.value = undefined;
      }
    };
    socket.onerror = () => {
      status.value = 'Disconnected';
    };
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        receive(event.data);
      }
    };
    ws.value = socket;
  }

  function disconnect() {
    ws.value?.close();
    ws.value = undefined;
  }

  watch(
    () => toValue(sessionId),
    () => load(),
  );

  function send(content: string, agent: string, provider: string) {
    const data = JSON.stringify({ content, provider, agent });
    const socket = ws.value;
    if (!socket) {
      return;
    }
    if (socket.readyState === WebSocket.CONNECTING) {
      socket.addEventListener('open', () => socket.send(data), { once: true });
      return;
    }
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(data);
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
