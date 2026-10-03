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
  sessionId: undefined as unknown,
  agentsValue: ['researcher'],
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
        agents: ref(socket.agentsValue),
        providers: ref(socket.providersValue),
      });
    },
  };
});

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

    expect(socket.send).toHaveBeenCalledWith('hello there', 'researcher', 'openai');
    expect(input.element.textContent).toBe('');
  });

  it('sends the turn the start page handed over', async () => {
    useChatStore().setPendingTurn({ sessionId: 'session-a', content: 'hello there', agent: 'researcher', provider: 'openai' });

    await mountChat('/en/chat/session-a');

    expect(socket.send).toHaveBeenCalledWith('hello there', 'researcher', 'openai');
  });

  it('leaves a turn meant for another session alone', async () => {
    useChatStore().setPendingTurn({ sessionId: 'session-b', content: 'hello there', agent: 'researcher', provider: 'openai' });

    await mountChat('/en/chat/session-a');

    expect(socket.send).not.toHaveBeenCalled();
  });
});
