import * as api from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import { useChatSocket } from './useChatSocket';

vi.mock('@/api', () => ({ getAgentsNames: vi.fn(), getProvidersModels: vi.fn(), getSessionsByUuid: vi.fn(), getSessionsByUuidMessages: vi.fn() }));

class FakeSocket {
  public static CONNECTING = 0;
  public static OPEN = 1;
  public static CLOSED = 3;
  public static opened: string[] = [];
  public static closed: string[] = [];
  public static instances: FakeSocket[] = [];

  public url: string;
  public sent: string[] = [];
  public readyState = FakeSocket.OPEN;
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessage: ((event: unknown) => void) | null = null;
  private listeners: Record<string, (() => void)[]> = {};

  public constructor(url: string) {
    this.url = url;
    FakeSocket.opened.push(url);
    FakeSocket.instances.push(this);
  }

  public addEventListener(type: string, listener: () => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  public close() {
    FakeSocket.closed.push(this.url);
  }

  public open() {
    this.readyState = FakeSocket.OPEN;
    this.listeners.open?.forEach((listener) => listener());
    this.onopen?.();
  }

  public serverClose() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }

  public serverError() {
    this.onerror?.();
  }

  public send(data: string) {
    this.sent.push(data);
  }
}

function socketPath(url: string): string {
  return new URL(url).pathname;
}

let pinia: Pinia;
let scope: EffectScope;

function openChat(sessionId: ReturnType<typeof ref<string | undefined>>) {
  let chatSocket!: ReturnType<typeof useChatSocket>;
  scope = effectScope();
  scope.run(() => {
    chatSocket = useChatSocket(sessionId);
  });
  return chatSocket;
}

describe('useChatSocket', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    FakeSocket.opened = [];
    FakeSocket.closed = [];
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.clearAllMocks();
    (api.getAgentsNames as Mock).mockResolvedValue({ data: ['researcher'] });
    (api.getProvidersModels as Mock).mockResolvedValue({ data: [{ name: 'openai', model_name: 'gpt-5' }] });
    (api.getSessionsByUuid as Mock).mockResolvedValue({ data: { id: 'session-a', plan_items: [] } });
    (api.getSessionsByUuidMessages as Mock).mockResolvedValue({ data: [] });
    useAuthStore().setTokens('access-token', 'refresh-token');
  });

  afterEach(() => {
    scope?.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens the socket of the session it is given', async () => {
    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    expect(FakeSocket.opened.map(socketPath)).toEqual(['/agent-api/chat/ws/session-a']);
  });

  it('reopens the socket when the session changes after load', async () => {
    const sessionId = ref('session-a');
    const chatSocket = openChat(sessionId);
    await chatSocket.load();

    sessionId.value = 'session-b';
    await nextTick();

    // The page stays mounted across a chat-to-chat navigation, so nothing else
    // would ever ask for the second session's socket.
    expect(FakeSocket.opened.map(socketPath)).toEqual(['/agent-api/chat/ws/session-a', '/agent-api/chat/ws/session-b']);
    expect(FakeSocket.closed.map(socketPath)).toEqual(['/agent-api/chat/ws/session-a']);
  });

  it('loads the session history it is given', async () => {
    (api.getSessionsByUuidMessages as Mock).mockResolvedValue({
      data: [{ seq: 1, role: 'user', data: { content: 'hi' } }],
    });

    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    expect(api.getSessionsByUuidMessages).toHaveBeenCalledWith({ path: { uuid: 'session-a' } });
    expect(chatSocket.history).toEqual([{ seq: 1, role: 'user', data: { content: 'hi' } }]);
  });

  it('loads no history when there is no session', async () => {
    const chatSocket = openChat(ref(undefined));
    await chatSocket.load();

    expect(api.getSessionsByUuidMessages).not.toHaveBeenCalled();
    expect(chatSocket.history).toEqual([]);
    expect(chatSocket.planItems).toEqual([]);
  });

  it('loads the plan the session endpoint holds', async () => {
    (api.getSessionsByUuid as Mock).mockResolvedValue({ data: { id: 'session-a', plan_items: [{ id: 'p1', content: 'Draft the plan', status: 'completed' }] } });

    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    expect(api.getSessionsByUuid).toHaveBeenCalledWith({ path: { uuid: 'session-a' } });
    expect(chatSocket.planItems).toEqual([{ id: 'p1', content: 'Draft the plan', status: 'completed' }]);
  });

  it('replaces the plan when the engine pushes a new one', async () => {
    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    const socket = FakeSocket.instances[0] as FakeSocket;
    socket.onmessage?.({ data: JSON.stringify({ agent_id: 'researcher:session-a', path: [], payload: [{ id: 'p1', content: 'Draft', status: 'pending' }] }) });

    expect(chatSocket.planItems).toEqual([{ id: 'p1', content: 'Draft', status: 'pending' }]);
  });

  it('clears the plan when the engine sends an empty one', async () => {
    (api.getSessionsByUuid as Mock).mockResolvedValue({ data: { id: 'session-a', plan_items: [{ id: 'p1', content: 'Draft', status: 'pending' }] } });
    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    const socket = FakeSocket.instances[0] as FakeSocket;
    socket.onmessage?.({ data: JSON.stringify({ agent_id: 'researcher:session-a', path: [], payload: [] }) });

    expect(chatSocket.planItems).toEqual([]);
  });

  it('sends the turn the agent cloud resolves', async () => {
    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    chatSocket.send('hello', 'researcher', 'openai');

    expect(FakeSocket.instances[0]?.sent).toEqual([JSON.stringify({ content: 'hello', provider: 'openai', agent: 'researcher' })]);
  });

  it('holds a turn until the socket opens', async () => {
    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    const socket = FakeSocket.instances[0] as FakeSocket;
    socket.readyState = FakeSocket.CONNECTING;
    chatSocket.send('hello', 'researcher', 'openai');

    expect(socket.sent).toEqual([]);

    socket.open();

    expect(socket.sent).toEqual([JSON.stringify({ content: 'hello', provider: 'openai', agent: 'researcher' })]);
  });

  it('drops a turn when the socket is closed', async () => {
    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    const socket = FakeSocket.instances[0] as FakeSocket;
    socket.readyState = FakeSocket.CLOSED;
    chatSocket.send('hello', 'researcher', 'openai');

    expect(socket.sent).toEqual([]);
  });

  it('stops sending to the session it left', async () => {
    const sessionId = ref('session-a');
    const chatSocket = openChat(sessionId);
    await chatSocket.load();

    sessionId.value = 'session-b';
    await nextTick();
    chatSocket.send('hello', 'researcher', 'openai');

    expect(FakeSocket.instances[0]?.sent).toEqual([]);
    expect(FakeSocket.instances[1]?.sent).toHaveLength(1);
  });

  it('reports no connection when there is no session', async () => {
    const chatSocket = openChat(ref(undefined));
    await chatSocket.load();

    expect(chatSocket.status).toBe('idle');
  });

  it('reports the connection while it opens and once it is up', async () => {
    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    expect(chatSocket.status).toBe('connecting');

    (FakeSocket.instances[0] as FakeSocket).open();

    expect(chatSocket.status).toBe('connected');
  });

  it('reports an error and reconnects after the socket closes', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    (FakeSocket.instances[0] as FakeSocket).serverClose();

    expect(chatSocket.status).toBe('error');
    expect(FakeSocket.opened).toHaveLength(1);

    vi.advanceTimersByTime(1000);

    expect(FakeSocket.opened.map(socketPath)).toEqual(['/agent-api/chat/ws/session-a', '/agent-api/chat/ws/session-a']);
    expect(chatSocket.status).toBe('connecting');
  });

  it('waits longer after every failed attempt, up to the ceiling', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    const closeLatest = () => (FakeSocket.instances.at(-1) as FakeSocket).serverClose();

    closeLatest();
    vi.advanceTimersByTime(999);
    expect(FakeSocket.opened).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.opened).toHaveLength(2);

    closeLatest();
    vi.advanceTimersByTime(1999);
    expect(FakeSocket.opened).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.opened).toHaveLength(3);

    closeLatest();
    vi.advanceTimersByTime(3999);
    expect(FakeSocket.opened).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.opened).toHaveLength(4);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      closeLatest();
      vi.advanceTimersByTime(4999);
      expect(FakeSocket.opened).toHaveLength(4 + attempt);
      vi.advanceTimersByTime(1);
      expect(FakeSocket.opened).toHaveLength(5 + attempt);
    }
  });

  it('keeps retrying an unreachable session without giving up', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    for (let attempt = 0; attempt < 25; attempt += 1) {
      (FakeSocket.instances.at(-1) as FakeSocket).serverClose();
      vi.advanceTimersByTime(5000);
    }

    expect(FakeSocket.opened).toHaveLength(26);
  });

  it('does not reconnect the socket of the session it left', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const sessionId = ref('session-a');
    const chatSocket = openChat(sessionId);
    await chatSocket.load();

    sessionId.value = 'session-b';
    await nextTick();

    (FakeSocket.instances[0] as FakeSocket).serverClose();
    vi.advanceTimersByTime(60000);

    expect(FakeSocket.opened).toHaveLength(2);
  });

  it('stops retrying once the scope is disposed', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const chatSocket = openChat(ref('session-a'));
    await chatSocket.load();

    (FakeSocket.instances[0] as FakeSocket).serverClose();
    scope.stop();
    vi.advanceTimersByTime(60000);

    expect(FakeSocket.opened).toHaveLength(1);
  });
});
