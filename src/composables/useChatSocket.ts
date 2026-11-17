import { computed, onScopeDispose, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { getAgentDefaultsBySource, getAgentsNames, getProvidersModels, getSessionsByUuid, getSessionsByUuidMessages, type ApiProviderSummaryDto } from '@/api';
import { fetchWithAuth } from '@/api-client/fetchWithAuth';
import { refreshSession } from '@/api-client/runtime';
import { agentNameById } from '@/config/agentDefaults';
import { toAgentEntries, type AgentEntry } from '@/config/agentList';
import { agentApiUrl } from '@/config/agentApi';
import type { ChatStatus } from '@/config/chatStatus';
import { agentWsUrl } from '@/config/runtime';
import { SESSION_SOURCE } from '@/config/sessionSource';
import { planItemsFrom, type PlanItem } from '@/config/sessions';
import { i18n } from '@/i18n';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { applyChatPayload, CHAT_STOPPED, chatPayloadError, chatPlanItems, chatTurnDone, openChatStream } from '@/utils/chatStream';
import { jwtExpiresAt } from '@/utils/jwt';

export type ChatSessionId = string | null | undefined;

interface PendingTurn {
  sessionId: string;
  content: string;
  agent: string;
  provider: string;
  images: string[];
  onSent?: () => void;
}

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 5000;
const RECONNECT_JITTER = 0.5;
const REPLAY_TIMEOUT_MS = 5000;
const TOKEN_RENEWAL_SKEW_MS = 60000;
const TOKEN_RENEWAL_MIN_DELAY_MS = 5000;
const SOCKET_TOKEN_REJECTED = 4401;

export function useChatSocket(sessionId: MaybeRefOrGetter<ChatSessionId>) {
  const authStore = useAuthStore();
  const alertStore = useAlertStore();
  const agents = ref<AgentEntry[]>([]);
  // A picker and the wire both address an agent by name; the id is only needed
  // to resolve a stored default agent, so the selectable names are derived here
  // rather than at every call site.
  const agentNames = computed(() => agents.value.map((agent) => agent.name));
  // The agent the user picked as the default for this source, by name, or '' when
  // the source holds none that can still be used.
  const defaultAgent = ref('');
  const sessionAgentId = ref('');
  const sessionAgentName = computed(() => agentNameById(agents.value, sessionAgentId.value || undefined));
  const providers = ref<ApiProviderSummaryDto[]>([]);
  const ws = shallowRef<WebSocket>();
  const status = ref<ChatStatus>('idle');
  const streaming = ref(false);
  // Set while the session's history and replay are being read, so the page can
  // hold its transcript back instead of showing an empty one that then fills in.
  const loading = ref(false);
  const streamingFromSeq = ref<number | null | undefined>(undefined);
  const history = ref<ChatHistoryEntry[]>([]);
  const planItems = ref<PlanItem[]>([]);
  let stream = openChatStream();
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let tokenTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectDelay = 0;
  let hasConnected = false;
  let pendingTurn: PendingTurn | null = null;
  let tokenRejected = false;
  // The highest replay seq applied. Replay and the live socket overlap by
  // design — the replay is a snapshot taken while the socket keeps streaming —
  // so every frame carries a per-room seq and anything at or below this is a
  // frame already folded into the history.
  let lastSeq = 0;
  // Frames that arrive while a resync is reading. Applying them first would
  // raise lastSeq past the replay's own frames and the replay would then be
  // discarded as stale, losing the turn's opening.
  let resyncInFlight: Promise<void> | null = null;
  let buffered: string[] = [];

  function accessTokenNeedsRenewal(): boolean {
    if (!authStore.refreshToken) {
      return false;
    }
    const expiresAt = jwtExpiresAt(authStore.accessToken);
    return expiresAt !== null && expiresAt - Date.now() <= TOKEN_RENEWAL_SKEW_MS;
  }

  async function renewAccessToken(): Promise<void> {
    if (!tokenRejected && !accessTokenNeedsRenewal()) {
      return;
    }
    tokenRejected = false;
    await refreshSession();
  }

  function pushToken() {
    const socket = ws.value;
    const token = authStore.accessToken;
    if (socket?.readyState !== WebSocket.OPEN || !token) {
      return;
    }
    socket.send(JSON.stringify({ kind: 'token', token }));
  }

  function scheduleTokenRenewal() {
    if (tokenTimer !== undefined) {
      clearTimeout(tokenTimer);
      tokenTimer = undefined;
    }
    const expiresAt = jwtExpiresAt(authStore.accessToken);
    if (expiresAt === null) {
      return;
    }
    const delay = Math.max(expiresAt - Date.now() - TOKEN_RENEWAL_SKEW_MS, TOKEN_RENEWAL_MIN_DELAY_MS);
    tokenTimer = setTimeout(() => {
      tokenTimer = undefined;
      void renewToken();
    }, delay);
  }

  async function renewToken(): Promise<void> {
    await renewAccessToken();
    pushToken();
    if (ws.value?.readyState === WebSocket.OPEN) {
      scheduleTokenRenewal();
    }
  }

  async function load() {
    pendingTurn = null;
    hasConnected = false;
    endStreaming();
    loading.value = true;
    try {
      await connect();
      await loadAgents();
      await loadAgentDefault();
      await loadProviders();
      await resync();
    } finally {
      loading.value = false;
    }
  }

  async function loadAgents() {
    const res = await getAgentsNames();
    if (res.data) {
      agents.value = toAgentEntries(res.data);
    }
  }

  /**
   * Reads the default agent this app's source holds and resolves it to a name.
   *
   * Read on every load rather than once, because the row is not the caller's to
   * keep: the cloud drops it when the agent it names is deleted or unshared, and
   * a name cached from an earlier load would then be a default the picker can no
   * longer select. A source with no default answers 404, which is the ordinary
   * shape of "nothing chosen yet" rather than a failure, so the error is left to
   * resolve to ''.
   */
  async function loadAgentDefault() {
    const { data } = await getAgentDefaultsBySource({ path: { source: SESSION_SOURCE } });
    defaultAgent.value = agentNameById(agents.value, data?.agent_id);
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
      sessionAgentId.value = '';
      return;
    }
    // Two endpoints by design: the messages endpoint answers with nothing else,
    // and the session endpoint is where the plan and the agent are kept. Neither
    // is optional.
    const [messagesResult, sessionResult] = await Promise.all([getSessionsByUuidMessages({ path: { uuid: id } }), getSessionsByUuid({ path: { uuid: id } })]);
    if (messagesResult.data) {
      replace(messagesResult.data as unknown as ChatHistoryEntry[]);
    }
    planItems.value = planItemsFrom(sessionResult.data?.plan_items);
    sessionAgentId.value = sessionResult.data?.agent_id ?? '';
  }

  function replace(messages: ChatHistoryEntry[]) {
    stream = openChatStream(messages);
    history.value = stream.messages;
    // The history endpoint is the baseline the replay is layered on, so the
    // numbering it was built from no longer describes what is on screen.
    lastSeq = 0;
  }

  async function fetchReplay(id: string): Promise<ChatEnvelope[]> {
    if (!authStore.accessToken) {
      return [];
    }
    try {
      const response = await fetchWithAuth(agentApiUrl(`/chat/${encodeURIComponent(id)}/replay`), {
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
    // A turn that ended in an error keeps its replay when the partial save
    // failed, and that one is over: its last event is the error.
    const last = events[events.length - 1].payload;
    streaming.value = !chatTurnDone(last) && chatPayloadError(last) === null;
    if (streaming.value) {
      streamingFromSeq.value = undefined;
    }
  }

  async function resync() {
    // Single flight. Pressing stop and losing the socket in the same moment used
    // to run two history+replay reads, and both of them folded the same events.
    const inFlight = resyncInFlight;
    if (inFlight) {
      return inFlight;
    }
    const run = (async () => {
      try {
        await loadHistory();
        await loadReplay();
      } finally {
        resyncInFlight = null;
        flushBuffered();
      }
    })();
    resyncInFlight = run;
    return run;
  }

  function flushBuffered() {
    // Replayed frames are already in; anything newer than lastSeq applies.
    const frames = buffered;
    buffered = [];
    for (const frame of frames) {
      receive(frame);
    }
  }

  async function revert(messageId: string): Promise<boolean> {
    const id = toValue(sessionId);
    if (!id || !authStore.accessToken || !messageId) {
      return false;
    }
    try {
      const response = await fetchWithAuth(agentApiUrl(`/chat/${encodeURIComponent(id)}/revert`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId }),
      });
      if (!response.ok) {
        alertStore.addItem({ level: 'error', message: i18n.global.t('chat.revertError') });
        return false;
      }
      await resync();
      return true;
    } catch {
      alertStore.addItem({ level: 'error', message: i18n.global.t('chat.revertError') });
      return false;
    }
  }

  function apply(envelope: ChatEnvelope) {
    // Already folded in: the same frame can reach here twice when a resync
    // snapshot overlaps the live socket, or when a reconnect replays the tail.
    if (typeof envelope.seq === 'number') {
      if (envelope.seq === 1) {
        // The room's counter restarted (a flushed or expired Redis key), so what
        // is on screen is not numbered on the same scale any more.
        lastSeq = 0;
      }
      if (envelope.seq <= lastSeq) {
        return;
      }
      lastSeq = envelope.seq;
    }
    // The plan is session state rather than a message: the engine pushes the
    // whole replaced plan as one array, which is kept beside the history instead
    // of inside it.
    const plan = chatPlanItems(envelope.payload);
    if (plan) {
      planItems.value = plan;
      return;
    }
    const before = stream.messages.length;
    stream = applyChatPayload(stream, envelope.agent_id, envelope.payload);
    history.value = stream.messages;
    // The first entry to land after a send is where the turn being written
    // begins, whatever its role: that is the fold the reader came to watch.
    if (streaming.value && streamingFromSeq.value === null && stream.messages.length > before) {
      streamingFromSeq.value = stream.messages[before]?.seq;
    }
    if (chatTurnDone(envelope.payload)) {
      endStreaming();
    }
  }

  function receive(data: string) {
    if (resyncInFlight) {
      buffered.push(data);
      return;
    }
    let envelope: ChatEnvelope;
    try {
      envelope = JSON.parse(data) as ChatEnvelope;
    } catch {
      return;
    }
    const error = chatPayloadError(envelope.payload);
    if (error) {
      endStreaming();
      if (error === CHAT_STOPPED) {
        // The runner saves the partial turn before it announces the stop, so the
        // stored session is now the truth for this turn: drop the locally
        // streamed draft and read it back.
        void resync();
        return;
      }
      alertStore.addItem({ level: 'error', message: error });
      return;
    }
    apply(envelope);
  }

  function chatSocketUrl(sessionId: string, token: string): string {
    const url = new URL(agentWsUrl(`/chat/ws/${encodeURIComponent(sessionId)}`));
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
    socket.send(turnFrame(turn.content, turn.agent, turn.provider, turn.images));
    streamingFromSeq.value = null;
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
      scheduleTokenRenewal();
      // The first open is followed by load()'s own resync; only a reconnect
      // arrives with a gap of events to catch up on.
      if (hasConnected) {
        void resync();
      }
      hasConnected = true;
    };
    socket.onclose = (event) => {
      if (ws.value !== socket) {
        return;
      }
      if (event.code === SOCKET_TOKEN_REJECTED) {
        tokenRejected = true;
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

  async function openFreshConnection(): Promise<void> {
    if (toValue(sessionId)) {
      await renewAccessToken();
    }
    openSocket();
  }

  function connect(): Promise<void> {
    reconnectDelay = 0;
    return openFreshConnection();
  }

  function scheduleReconnect() {
    if (reconnectTimer !== undefined) {
      return;
    }
    reconnectDelay = reconnectDelay === 0 ? RECONNECT_BASE_DELAY : Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY);
    const jitter = 1 + (Math.random() * 2 - 1) * RECONNECT_JITTER;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void openFreshConnection();
    }, reconnectDelay * jitter);
  }

  function disconnect() {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    if (tokenTimer !== undefined) {
      clearTimeout(tokenTimer);
      tokenTimer = undefined;
    }
    ws.value?.close();
    ws.value = undefined;
  }

  watch(
    () => toValue(sessionId),
    () => load(),
  );

  function endStreaming() {
    streamingFromSeq.value = undefined;
    streaming.value = false;
    // The draft is keyed by agent id, which is the same key for every turn of a
    // session: left in place, the next turn's chunks would be appended onto the
    // stopped turn's text instead of starting a new entry.
    stream = openChatStream(stream.messages);
    history.value = stream.messages;
  }

  // An empty list stays off the wire, so a text-only turn sends the same frame
  // it always has.
  function turnFrame(content: string, agent: string, provider: string, images: string[]): string {
    return JSON.stringify(images.length > 0 ? { content, provider, agent, images } : { content, provider, agent });
  }

  function send(content: string, agent: string, provider: string, onSent?: () => void, images: string[] = []) {
    const id = toValue(sessionId);
    if (!id) {
      return;
    }
    const socket = ws.value;
    if (socket?.readyState === WebSocket.OPEN && !accessTokenNeedsRenewal()) {
      socket.send(turnFrame(content, agent, provider, images));
      streamingFromSeq.value = null;
      streaming.value = true;
      onSent?.();
      return;
    }
    pendingTurn = { sessionId: id, content, agent, provider, images, onSent };
    if (socket?.readyState !== WebSocket.CONNECTING) {
      void connect();
    }
    streamingFromSeq.value = null;
    streaming.value = true;
  }

  function stop() {
    if (pendingTurn) {
      pendingTurn = null;
      endStreaming();
      return;
    }
    const socket = ws.value;
    if (socket?.readyState !== WebSocket.OPEN) {
      // Nothing to stop on the wire: the turn cannot be running anywhere this
      // client can still see, so the UI must not stay in its streaming state.
      endStreaming();
      return;
    }
    socket.send(JSON.stringify({ kind: 'stop' }));
  }

  onScopeDispose(disconnect);

  return reactive({
    load,
    agents,
    agentNames,
    defaultAgent,
    sessionAgentName,
    providers,
    status,
    loading,
    streaming,
    streamingFromSeq,
    ws,
    history,
    planItems,
    connect,
    disconnect,
    resync,
    revert,
    send,
    stop,
  });
}
