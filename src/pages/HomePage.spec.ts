import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { defineComponent } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { i18n } from '@/i18n';
import { useChatStore } from '@/stores/chatStore';
import HomePage from './HomePage.vue';

const api = vi.hoisted(() => ({ postSessions: vi.fn() }));

vi.mock('@/api', () => ({ postSessions: api.postSessions }));

const socket = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('@/composables/useChatSocket', async () => {
  const { reactive, ref } = await import('vue');
  return {
    useChatSocket: () =>
      reactive({
        load: socket.load,
        agents: ref(['researcher']),
        providers: ref([{ name: 'openai', model_name: 'gpt-5' }]),
        status: ref('idle'),
      }),
  };
});

const ping = vi.hoisted(() => ({ status: 'connected' }));

vi.mock('@/composables/usePingStatus', async () => {
  const { ref } = await import('vue');
  return { usePingStatus: () => ({ status: ref(ping.status), check: vi.fn() }) };
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

async function mountHome() {
  const router = createTestRouter();
  await router.push('/en');
  await router.isReady();
  const wrapper = mount(HomePage, { global: { plugins: [i18n, router, pinia] } });
  await flushPromises();
  return { wrapper, router };
}

async function submit(wrapper: Awaited<ReturnType<typeof mountHome>>['wrapper'], text: string) {
  const input = wrapper.get('[data-testid="chat-input"]');
  input.element.textContent = text;
  await input.trigger('input');
  await wrapper.get('[data-testid="chat-send"]').trigger('click');
  await flushPromises();
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    api.postSessions.mockResolvedValue({ data: { id: 'session-new' } });
  });

  it('welcomes the user and offers the composer', async () => {
    const { wrapper } = await mountHome();

    expect(wrapper.get('[data-testid="home-hero"]').text()).toContain('Your AI assistant is ready');
    expect(wrapper.find('[data-testid="chat-input"]').exists()).toBe(true);
    expect(socket.load).toHaveBeenCalled();
  });

  it('shows the agent cloud connection in the composer', async () => {
    const { wrapper } = await mountHome();

    expect(wrapper.get('[data-testid="chat-status"]').classes()).toContain('status-success');
  });

  it('starts a session and carries the first turn to the chat', async () => {
    const { wrapper, router } = await mountHome();

    await submit(wrapper, 'hello there');

    expect(api.postSessions).toHaveBeenCalledWith({ body: {} });
    expect(useChatStore().pendingTurn).toEqual({ sessionId: 'session-new', content: 'hello there', agent: 'researcher', provider: 'openai' });
    expect(router.currentRoute.value.fullPath).toBe('/en/chat/session-new');
  });

  it('starts nothing when the session could not be created', async () => {
    api.postSessions.mockResolvedValue({ error: { error: { code: 'INTERNAL', message: 'boom' } } });
    const { wrapper, router } = await mountHome();

    await submit(wrapper, 'hello there');

    expect(useChatStore().pendingTurn).toBeNull();
    expect(router.currentRoute.value.fullPath).toBe('/en');
  });
});
