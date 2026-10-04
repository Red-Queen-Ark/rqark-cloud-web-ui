import { onScopeDispose, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { getAgentsNames, getProvidersModels, getSessionsByUuid, getSessionsByUuidMessages, type ApiProviderSummaryDto } from '@/api';
import { agentApiUrl } from '@/config/agentApi';
import type { ChatStatus } from '@/config/chatStatus';
import { planItemsFrom, type PlanItem } from '@/config/sessions';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { applyChatPayload, chatPayloadError, chatPlanItems, openChatStream } from '@/utils/chatStream';

export type ChatSessionId = string | null | undefined;

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 5000;
const RECONNECT_JITTER = 0.5;

export function useChatSocket(sessionId: MaybeRefOrGetter<ChatSessionId>) {
  const authStore = useAuthStore();
  const alertStore = useAlertStore();
  const agents = ref<string[]>([]);
  const providers = ref<ApiProviderSummaryDto[]>([]);
  const ws = shallowRef<WebSocket>();
  const status = ref<ChatStatus>('idle');
  const history = ref<ChatHistoryEntry[]>([]);
  const planItems = ref<PlanItem[]>([]);
  let stream = openChatStream();
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectDelay = 0;

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
      planItems.value = [];
      return;
    }
    // Two endpoints by design: the messages endpoint answers with nothing else,
    // and the session endpoint is where the plan is kept. Neither is optional.
    const [messagesResult, sessionResult] = await Promise.all([getSessionsByUuidMessages({ path: { uuid: id } }), getSessionsByUuid({ path: { uuid: id } })]);
    if (messagesResult.data) {
      replace(messagesResult.data as unknown as ChatHistoryEntry[]);
    }
    planItems.value = planItemsFrom(sessionResult.data?.plan_items);
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
    // The plan is session state rather than a message: the engine pushes the
    // whole replaced plan as one array, which is kept beside the history instead
    // of inside it.
    const plan = chatPlanItems(envelope.payload);
    if (plan) {
      planItems.value = plan;
      return;
    }
    stream = applyChatPayload(stream, envelope.agent_id, envelope.payload);
    history.value = stream.messages;
  }

  function chatSocketUrl(sessionId: string, token: string): string {
    const url = new URL(agentApiUrl(`/chat/ws/${encodeURIComponent(sessionId)}`), window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', token);
    return url.toString();
  }

  function openSocket() {
    disconnect();
    const id = toValue(sessionId);
    const token = authStore.accessToken;
    if (!id || !token) {
      status.value = 'idle';
      return;
    }
    status.value = 'connecting';
    const socket = new WebSocket(chatSocketUrl(id, token));
    socket.onopen = () => {
      if (ws.value !== socket) {
        return;
      }
      reconnectDelay = 0;
      status.value = 'connected';
    };
    socket.onclose = () => {
      if (ws.value !== socket) {
        return;
      }
      ws.value = undefined;
      status.value = 'error';
      scheduleReconnect();
    };
    socket.onerror = () => {
      if (ws.value !== socket) {
        return;
      }
      status.value = 'error';
    };
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        receive(event.data);
      }
    };
    ws.value = socket;
  }

  function connect() {
    reconnectDelay = 0;
    openSocket();
  }

  function scheduleReconnect() {
    if (reconnectTimer !== undefined) {
      return;
    }
    reconnectDelay = reconnectDelay === 0 ? RECONNECT_BASE_DELAY : Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY);
    const jitter = 1 + (Math.random() * 2 - 1) * RECONNECT_JITTER;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      openSocket();
    }, reconnectDelay * jitter);
  }

  function disconnect() {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
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
    planItems,
    connect,
    disconnect,
    send,
  });
}
