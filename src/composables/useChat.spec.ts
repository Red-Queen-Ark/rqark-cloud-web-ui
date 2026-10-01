import * as api from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import { useChat } from './useChat';

vi.mock('@/api', () => ({ getAgents: vi.fn(), getProviders: vi.fn() }));

/** Stands in for the browser WebSocket so the handshake never leaves the test. */
class FakeSocket {
  public static opened: FakeSocket[] = [];
  public closed = false;

  public constructor(public url: string) {
    FakeSocket.opened.push(this);
  }

  public close(): void {
    this.closed = true;
  }

  public static get last(): FakeSocket {
    const socket = FakeSocket.opened.at(-1);
    if (!socket) {
      throw new Error('No socket was opened');
    }
    return socket;
  }
}

function lastPath(): string {
  return new URL(FakeSocket.last.url).pathname;
}

/** useChat registers an onScopeDispose, so it has to run inside a scope. */
function setup(sessionId: string | undefined): { scope: EffectScope; sessionId: ReturnType<typeof ref<string | undefined>> } & ReturnType<typeof useChat> {
  const scope = effectScope();
  const id = ref<string | undefined>(sessionId);
  const chat = scope.run(() => useChat(id)) as ReturnType<typeof useChat>;
  return { scope, sessionId: id, ...chat };
}

describe('useChat', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().setTokens('access-token', 'refresh-token');
    (api.getAgents as Mock).mockResolvedValue({ data: [] });
    (api.getProviders as Mock).mockResolvedValue({ data: [] });
    FakeSocket.opened = [];
    vi.stubGlobal('WebSocket', FakeSocket);
  });

  it('opens the socket of the session the route names', async () => {
    const chat = setup('session-a');
    await chat.load();

    const url = new URL(FakeSocket.last.url);
    expect(url.protocol).toBe('ws:');
    // The chat session runs on the agent cloud, which is a separate service from
    // the data cloud that answers the REST calls, so it is addressed under its
    // own prefix rather than `/api`.
    expect(url.pathname.endsWith('/agent-api/chat/ws/session-a')).toBe(true);
    // The handshake cannot carry an Authorization header, so the token travels
    // as the query parameter the backend reads.
    expect(url.searchParams.get('token')).toBe('access-token');
  });

  it('escapes the session id instead of letting it rewrite the path', async () => {
    const chat = setup('../../admin');
    await chat.load();

    expect(lastPath().endsWith('/agent-api/chat/ws/..%2F..%2Fadmin')).toBe(true);
  });

  it('follows the session when the route switches to another one', async () => {
    const chat = setup('session-a');
    await chat.load();
    const first = FakeSocket.last;

    chat.sessionId.value = 'session-b';
    await nextTick();

    // Reading and writing the previous session after a switch would post the
    // messages into the wrong conversation.
    expect(first.closed).toBe(true);
    expect(lastPath().endsWith('/agent-api/chat/ws/session-b')).toBe(true);
  });

  it('stays disconnected while the url names no session', async () => {
    const chat = setup(undefined);
    await chat.load();

    expect(FakeSocket.opened).toHaveLength(0);

    chat.sessionId.value = 'session-c';
    await nextTick();

    expect(lastPath().endsWith('/agent-api/chat/ws/session-c')).toBe(true);
  });

  it('stays disconnected without a token, since the backend refuses the handshake', async () => {
    useAuthStore().clearSession();

    const chat = setup('session-a');
    await chat.load();

    expect(FakeSocket.opened).toHaveLength(0);
  });

  it('closes the socket when the page it belongs to goes away', async () => {
    const chat = setup('session-a');
    await chat.load();
    const socket = FakeSocket.last;

    chat.scope.stop();

    expect(socket.closed).toBe(true);
  });

  it('collects the agents and providers it can chat with', async () => {
    (api.getAgents as Mock).mockResolvedValue({ data: [{ name: 'researcher' }, { name: 'writer' }] });
    (api.getProviders as Mock).mockResolvedValue({ data: [{ name: 'openai', model_name: 'gpt-5' }] });

    const chat = setup('session-a');
    await chat.load();

    expect(chat.agents.value).toEqual(['researcher', 'writer']);
    expect(chat.providers.value).toEqual([{ name: 'openai', model_name: 'gpt-5' }]);
  });
});
