import * as api from '@/api';
import { i18n } from '@/i18n';
import { useAlertStore } from '@/stores/alertStore';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import SidebarChatSessionsList from './SidebarChatSessionsList.vue';

vi.mock('@/api', () => ({ getSessions: vi.fn() }));

const latest = { id: 'session-latest', title: 'Latest chat', created_at: '2026-04-05T06:07:08Z', updated_at: '2026-04-08T09:10:11Z' };
const older = { id: 'session-older', title: 'Older chat', created_at: '2026-04-04T06:07:08Z', updated_at: '2026-04-05T06:07:08Z' };
// Started by the app before the user named it, so it carries no title.
const untitled = { id: 'session-untitled', title: '', created_at: '2026-04-06T06:07:08Z', updated_at: '2026-04-06T06:07:08Z' };

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

const SESSIONS = '[data-testid="sidebar-chat-sessions"]';

let pinia: Pinia;

async function mountList(path = '/en') {
  const router = createTestRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(SidebarChatSessionsList, { global: { plugins: [i18n, router, pinia] } });
  await flushPromises();
  return wrapper;
}

describe('SidebarChatSessionsList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('orders the sessions by their most recent activity', async () => {
    (api.getSessions as Mock).mockResolvedValue({ data: [older, untitled, latest] });

    const wrapper = await mountList();

    // The create action leads the list; a session with no title says so.
    expect(wrapper.findAll(`${SESSIONS} a`).map((link) => link.text())).toEqual(['New session', 'Latest chat', 'Untitled session', 'Older chat']);
  });

  it('marks the session the chat route is showing', async () => {
    (api.getSessions as Mock).mockResolvedValue({ data: [latest, older] });

    const wrapper = await mountList(`/en/chat/${latest.id}`);

    const active = wrapper.findAll(`${SESSIONS} a.menu-active`);
    expect(active).toHaveLength(1);
    expect(active[0].text()).toBe('Latest chat');
  });

  it('stops polling once it is unmounted', async () => {
    (api.getSessions as Mock).mockResolvedValue({ data: [] });
    const wrapper = await mountList();
    expect(api.getSessions).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(api.getSessions).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(api.getSessions).toHaveBeenCalledTimes(2);
  });

  it('reports a failing load once instead of once per poll', async () => {
    (api.getSessions as Mock).mockResolvedValue({ error: { error: { code: 'INTERNAL', message: 'boom' } } });

    const alerts = useAlertStore();
    const addItem = vi.spyOn(alerts, 'addItem');

    await mountList();
    expect(addItem).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(addItem).toHaveBeenCalledTimes(1);
  });
});
