import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { defineComponent, toValue } from 'vue';
import ChatPage from './ChatPage.vue';

const useChatMock = vi.hoisted(() => vi.fn(() => ({ load: vi.fn(), agents: { value: [] }, providers: { value: [] }, ws: { value: undefined }, connect: vi.fn(), disconnect: vi.fn() })));

vi.mock('@/composables/useChat', () => ({ useChat: useChatMock }));

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

async function mountChat(path: string) {
  const router = createTestRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(ChatPage, { global: { plugins: [router] } });
  return { wrapper, router };
}

describe('ChatPage', () => {
  beforeEach(() => {
    // The mock is shared, so a call recorded by one test would otherwise be read
    // as the call of the next one.
    vi.clearAllMocks();
  });

  it('hands the uuid from the route to the chat', async () => {
    await mountChat('/en/chat/session-a');

    const sessionId = useChatMock.mock.calls[0]?.[0];
    expect(toValue(sessionId)).toBe('session-a');
  });

  it('loads the chat once it is on screen', async () => {
    await mountChat('/en/chat/session-a');

    expect(useChatMock.mock.results[0]?.value.load).toHaveBeenCalled();
  });

  it('keeps naming the current session after the route switches', async () => {
    const { router } = await mountChat('/en/chat/session-a');
    const sessionId = useChatMock.mock.calls[0]?.[0];

    await router.push('/en/chat/session-b');

    // The page is reused for the new route, so a one-off read of the param would
    // keep the previous session open.
    expect(toValue(sessionId)).toBe('session-b');
  });

  it('names no session outside a chat url', async () => {
    await mountChat('/en');

    expect(toValue(useChatMock.mock.calls[0]?.[0])).toBeUndefined();
  });
});
