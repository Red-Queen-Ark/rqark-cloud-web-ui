import { onScopeDispose, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { getAgentsNames, getProvidersModels, getSessionsByUuid, getSessionsByUuidMessages, type ApiProviderSummaryDto } from '@/api';
import { refreshSession } from '@/api-client/runtime';
import { agentApiUrl } from '@/config/agentApi';
import type { ChatStatus } from '@/config/chatStatus';
import { planItemsFrom, type PlanItem } from '@/config/sessions';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { applyChatPayload, CHAT_STOPPED, chatPayloadError, chatPlanItems, chatTurnDone, openChatStream } from '@/utils/chatStream';

export type ChatSessionId = string | null | undefined;

interface PendingTurn {
  sessionId: string;
  content: string;
  agent: string;
  provider: string;
  onSent?: () => void;
}

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 5000;
const RECONNECT_JITTER = 0.5;
const REPLAY_TIMEOUT_MS = 5000;

export function useChatSocket(sessionId: MaybeRefOrGetter<ChatSessionId>) {
  const authStore = useAuthStore();
  const alertStore = useAlertStore();
  const agents = ref<string[]>([]);
  const providers = ref<ApiProviderSummaryDto[]>([]);
  const ws = shallowRef<WebSocket>();
  const status = ref<ChatStatus>('idle');
  const streaming = ref(false);
  const history = ref<ChatHistoryEntry[]>([]);
  const planItems = ref<PlanItem[]>([]);
  let stream = openChatStream();
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectDelay = 0;
  let hasConnected = false;
  let pendingTurn: PendingTurn | null = null;

  async function load() {
    pendingTurn = null;
    hasConnected = false;
    connect();
    await loadAgents();
    await loadProviders();
    await resync();
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

  async function fetchReplay(id: string): Promise<ChatEnvelope[]> {
    const token = authStore.accessToken;
    if (!token) {
      return [];
    }
    try {
      const response = await fetch(agentApiUrl(`/chat/${encodeURIComponent(id)}/replay`), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REPLAY_TIMEOUT_MS),
      });
      if (!response.ok) {
        return [];
      }
      const events = (await response.json()) as ChatEnvelope[];
      return Array.isArray(events) ? events : [];
    } catch {
      return [];
    }
  }

  async function loadReplay() {
    const id = toValue(sessionId);
    if (!id) {
      return;
    }
    const events = await fetchReplay(id);
    if (events.length === 0) {
      return;
    }
    // A running chat streams its events and clears them once it ends, so a
    // non-empty replay is a turn still in flight: rebuild it on top of the
    // history the session endpoint answered with.
    for (const envelope of events) {
      apply(envelope);
    }
    streaming.value = !chatTurnDone(events[events.length - 1].payload);
  }

  async function resync() {
    await loadHistory();
    await loadReplay();
  }

  function apply(envelope: ChatEnvelope) {
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
    if (chatTurnDone(envelope.payload)) {
      streaming.value = false;
    }
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
      streaming.value = false;
      if (error !== CHAT_STOPPED) {
        alertStore.addItem({ level: 'error', message: error });
      }
      return;
    }
    apply(envelope);
  }

  function chatSocketUrl(sessionId: string, token: string): string {
    const url = new URL(agentApiUrl(`/chat/ws/${encodeURIComponent(sessionId)}`), window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', token);
    return url.toString();
  }

  function flushPending(socket: WebSocket) {
    const turn = pendingTurn;
    if (!turn) {
      return;
    }
    pendingTurn = null;
    if (turn.sessionId !== toValue(sessionId)) {
      return;
    }
    socket.send(JSON.stringify({ content: turn.content, provider: turn.provider, agent: turn.agent }));
    streaming.value = true;
    turn.onSent?.();
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
      flushPending(socket);
      // The first open is followed by load()'s own resync; only a reconnect
      // arrives with a gap of events to catch up on.
      if (hasConnected) {
        void resync();
      }
      hasConnected = true;
    };
    socket.onclose = () => {
      if (ws.value !== socket) {
        return;
      }
      ws.value = undefined;
      status.value = 'error';
      streaming.value = pendingTurn !== null;
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
      void reconnect();
    }, reconnectDelay * jitter);
  }

  async function reconnect() {
    if (pendingTurn) {
      await refreshSession();
    }
    openSocket();
  }

  function disconnect() {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    ws.value?.close();
    ws.value = undefined;
    streaming.value = false;
  }

  watch(
    () => toValue(sessionId),
    () => load(),
  );

  function send(content: string, agent: string, provider: string, onSent?: () => void) {
    const id = toValue(sessionId);
    if (!id) {
      return;
    }
    const socket = ws.value;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ content, provider, agent }));
      streaming.value = true;
      onSent?.();
      return;
    }
    pendingTurn = { sessionId: id, content, agent, provider, onSent };
    if (socket?.readyState !== WebSocket.CONNECTING) {
      connect();
    }
    streaming.value = true;
  }

  function stop() {
    if (pendingTurn) {
      pendingTurn = null;
      streaming.value = false;
      return;
    }
    const socket = ws.value;
    if (socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify({ kind: 'stop' }));
  }

  onScopeDispose(disconnect);

  return reactive({
    load,
    agents,
    providers,
    status,
    streaming,
    ws,
    history,
    planItems,
    connect,
    disconnect,
    send,
    stop,
  });
}
