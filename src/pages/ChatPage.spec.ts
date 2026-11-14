import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { defineComponent, toValue } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { i18n } from '@/i18n';
import { useChatStore } from '@/stores/chatStore';
import ChatPage from './ChatPage.vue';

const socket = vi.hoisted(() => ({
  load: vi.fn(),
  send: vi.fn(),
  stop: vi.fn(),
  sessionId: undefined as unknown,
  agentsValue: [{ id: 'agent-1', name: 'researcher' }],
  providersValue: [{ name: 'openai', model_name: 'gpt-5' }],
}));

vi.mock('@/composables/useChatSocket', async () => {
  const { reactive, ref } = await import('vue');
  return {
    useChatSocket: (sessionId: unknown) => {
      socket.sessionId = sessionId;
      return reactive({
        load: socket.load,
        send: socket.send,
        stop: socket.stop,
        agents: ref(socket.agentsValue),
        agentNames: ref(socket.agentsValue.map((agent) => agent.name)),
        defaultAgent: ref(''),
        providers: ref(socket.providersValue),
        history: ref([]),
        planItems: ref([]),
        status: ref('connected'),
        streaming: ref(false),
      });
    },
  };
});

const api = vi.hoisted(() => ({ putSessionsByUuid: vi.fn(), getProjects: vi.fn() }));

vi.mock('@/api', () => ({ putSessionsByUuid: api.putSessionsByUuid, getProjects: api.getProjects }));

const Blank = defineComponent({ template: '<div />' });

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/:lang', name: 'home', component: Blank },
      { path: '/:lang/chat/:uuid', name: 'chat', component: Blank },
    ],
  });
}

let pinia: Pinia;

async function mountChat(path: string) {
  const router = createTestRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(ChatPage, { global: { plugins: [i18n, router, pinia] } });
  await flushPromises();
  return { wrapper, router };
}

describe('ChatPage', () => {
  beforeEach(() => {
    // The mock is shared, so a call recorded by one test would otherwise be read
    // as the call of the next one.
    vi.clearAllMocks();
    socket.agentsValue = [{ id: 'agent-1', name: 'researcher' }];
    socket.send.mockImplementation((...args: unknown[]) => (args[3] as (() => void) | undefined)?.());
    api.getProjects.mockResolvedValue({ data: [{ id: 'p1', project_name: 'Acme', project_path: 'acme' }] });
    api.putSessionsByUuid.mockResolvedValue({ data: {} });
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it('hands the uuid from the route to the chat', async () => {
    await mountChat('/en/chat/session-a');

    expect(toValue(socket.sessionId)).toBe('session-a');
  });

  it('loads the chat once it is on screen', async () => {
    await mountChat('/en/chat/session-a');

    expect(socket.load).toHaveBeenCalled();
  });

  it('keeps naming the current session after the route switches', async () => {
    const { router } = await mountChat('/en/chat/session-a');

    await router.push('/en/chat/session-b');

    // The page is reused for the new route, so a one-off read of the param would
    // keep the previous session open.
    expect(toValue(socket.sessionId)).toBe('session-b');
  });

  it('names no session outside a chat url', async () => {
    await mountChat('/en');

    expect(toValue(socket.sessionId)).toBeUndefined();
  });

  it('sends the typed turn with the chosen agent and provider', async () => {
    const { wrapper } = await mountChat('/en/chat/session-a');

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello there';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(socket.send).toHaveBeenCalledWith('hello there', 'researcher', 'openai', expect.any(Function), []);
    expect(input.element.textContent).toBe('');
  });

  it('keeps the typed turn until the socket has taken it', async () => {
    socket.send.mockImplementation(() => undefined);
    const { wrapper } = await mountChat('/en/chat/session-a');

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello there';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(input.element.textContent).toBe('hello there');
  });

  it('sends the turn the start page handed over', async () => {
    useChatStore().setPendingTurn({ sessionId: 'session-a', content: 'hello there', agent: 'researcher', provider: 'openai' });

    await mountChat('/en/chat/session-a');

    expect(socket.send).toHaveBeenCalledWith('hello there', 'researcher', 'openai', undefined, []);
  });

  it('keeps a draft per session across a switch', async () => {
    const { wrapper, router } = await mountChat('/en/chat/session-a');

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'half a thought';
    await input.trigger('input');

    await router.push('/en/chat/session-b');
    expect(input.element.textContent).toBe('');

    input.element.textContent = 'another thought';
    await input.trigger('input');

    await router.push('/en/chat/session-a');
    expect(input.element.textContent).toBe('half a thought');

    await router.push('/en/chat/session-b');
    expect(input.element.textContent).toBe('another thought');
  });

  it('brings the draft back when the chat is opened again', async () => {
    useChatStore().setDraft('session-a', 'still writing');

    const { wrapper } = await mountChat('/en/chat/session-a');

    expect(wrapper.get('[data-testid="chat-input"]').element.textContent).toBe('still writing');
  });

  it('drops the draft once the turn has been sent', async () => {
    const { wrapper } = await mountChat('/en/chat/session-a');

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello there';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(useChatStore().sessionDrafts['session-a']).toBeUndefined();
  });

  it('answers /stop by stopping the turn instead of sending it', async () => {
    const { wrapper } = await mountChat('/en/chat/session-a');

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = '/stop';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(socket.stop).toHaveBeenCalledTimes(1);
    expect(socket.send).not.toHaveBeenCalled();
    expect(input.element.textContent).toBe('');
  });

  it('sends /compact as a turn so the server can compact the conversation', async () => {
    const { wrapper } = await mountChat('/en/chat/session-a');

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = '/compact';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(socket.send).toHaveBeenCalledWith('/compact', 'researcher', 'openai', expect.any(Function), []);
    expect(socket.stop).not.toHaveBeenCalled();
  });

  it('leaves a turn meant for another session alone', async () => {
    useChatStore().setPendingTurn({ sessionId: 'session-b', content: 'hello there', agent: 'researcher', provider: 'openai' });

    await mountChat('/en/chat/session-a');

    expect(socket.send).not.toHaveBeenCalled();
  });

  it('comes up on the agent the start page sent the turn to', async () => {
    socket.agentsValue = [
      { id: 'agent-1', name: 'researcher' },
      { id: 'agent-2', name: 'writer' },
    ];
    useChatStore().setPendingTurn({ sessionId: 'session-a', content: 'hello there', agent: 'writer', provider: 'openai' });

    const { wrapper } = await mountChat('/en/chat/session-a');

    // The home page picks the agent, then hands the turn over to a page that
    // never saw it; the picker must not fall back to the first agent there.
    expect(wrapper.get('[data-testid="chat-agent-select"]').attributes('data-value')).toBe('writer');
  });

  it('sends the images a turn from the home page was carrying', async () => {
    const uri = 'data:image/png;base64,AAAA';
    useChatStore().setPendingTurn({ sessionId: 'session-a', content: 'hello there', agent: 'researcher', provider: 'openai', images: [uri] });

    await mountChat('/en/chat/session-a');
    await flushPromises();

    expect(socket.send).toHaveBeenCalledWith('hello there', 'researcher', 'openai', undefined, [uri]);
  });

  it('remembers the agent a session was sent to', async () => {
    socket.agentsValue = [
      { id: 'agent-1', name: 'researcher' },
      { id: 'agent-2', name: 'writer' },
    ];
    const { wrapper } = await mountChat('/en/chat/session-a');

    await wrapper.get('[data-testid="chat-agent-option"][data-value="writer"]').trigger('click');
    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello there';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(socket.send).toHaveBeenCalledWith('hello there', 'writer', 'openai', expect.any(Function), []);
    expect(useChatStore().agentFor('session-a')).toBe('writer');
  });
  it('writes a project change onto the session rather than the turn', async () => {
    const { wrapper } = await mountChat('/en/chat/session-1');
    const chatStore = useChatStore();
    chatStore.setSessionProjects([{ id: 'session-1', updated_at: '2026-01-01T00:00:00Z' }]);

    await wrapper.get('[data-testid="chat-project-option"][data-value="p1"]').trigger('click');
    await flushPromises();

    expect(api.putSessionsByUuid).toHaveBeenCalledWith({ path: { uuid: 'session-1' }, body: { project_id: 'p1' } });
    expect(chatStore.sessionProjects['session-1']).toBe('p1');
    // Nothing is sent: the engine reads the stored value when it builds the next turn.
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('puts the picker back when the cloud refuses the project change', async () => {
    api.putSessionsByUuid.mockResolvedValue({ error: { error: { code: 'BAD_REQUEST', message: 'no' } } });
    const { wrapper } = await mountChat('/en/chat/session-1');
    const chatStore = useChatStore();
    chatStore.setSessionProjects([{ id: 'session-1', updated_at: '2026-01-01T00:00:00Z' }]);

    await wrapper.get('[data-testid="chat-project-option"][data-value="p1"]').trigger('click');
    await flushPromises();

    expect(chatStore.sessionProjects['session-1']).toBeNull();
    expect(wrapper.get('[data-testid="chat-project-select"]').attributes('data-value')).toBe('');
  });
});
