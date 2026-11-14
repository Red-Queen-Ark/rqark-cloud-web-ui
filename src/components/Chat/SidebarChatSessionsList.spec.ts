import * as api from '@/api';
import { i18n } from '@/i18n';
import { useAlertStore } from '@/stores/alertStore';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import SidebarChatSessionsList from './SidebarChatSessionsList.vue';

vi.mock('@/api', () => ({ getSessions: vi.fn(), getProjects: vi.fn() }));

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
    (api.getProjects as Mock).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('orders the sessions by their most recent activity', async () => {
    (api.getSessions as Mock).mockResolvedValue({ data: [older, untitled, latest] });

    const wrapper = await mountList();

    // The create action leads the list; a session with no title says so.
    expect(wrapper.findAll(`${SESSIONS} a`).map((link) => link.text())).toEqual(['New session', 'Latest chat', 'Untitled session', 'Older chat']);

    // The create action carries the plus icon that marks it as an add action.
    expect(wrapper.findAll(`${SESSIONS} a`)[0].find('svg').exists()).toBe(true);
  });

  it('marks the session the chat route is showing', async () => {
    (api.getSessions as Mock).mockResolvedValue({ data: [latest, older] });

    const wrapper = await mountList(`/en/chat/${latest.id}`);

    const active = wrapper.findAll(`${SESSIONS} a.menu-active`);
    expect(active).toHaveLength(1);
    expect(active[0].text()).toBe('Latest chat');
  });

  it('marks the create action while the home route is showing', async () => {
    (api.getSessions as Mock).mockResolvedValue({ data: [latest] });

    const wrapper = await mountList('/en');

    const active = wrapper.findAll(`${SESSIONS} a.menu-active`);
    expect(active).toHaveLength(1);
    expect(active[0].text()).toBe('New session');
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

  it('asks the cloud only for the sessions the agent cloud recorded', async () => {
    (api.getSessions as Mock).mockResolvedValue({ data: [latest] });

    await mountList();

    expect(api.getSessions).toHaveBeenCalledWith({ query: { source: 'AGENT_CLOUD' } });
  });

  it('files a session under its project and leaves the rest in Chat', async () => {
    (api.getProjects as Mock).mockResolvedValue({ data: [{ id: 'p1', project_name: 'Acme', project_path: 'acme' }] });
    (api.getSessions as Mock).mockResolvedValue({ data: [{ ...latest, project_id: 'p1' }, older] });

    const wrapper = await mountList();
    await wrapper.get('[data-testid="sidebar-projects-toggle"]').trigger('click');

    const inProject = wrapper.findAll('[data-testid="sidebar-project-sessions-p1"] a');
    expect(inProject.map((link) => link.text())).toEqual(['Latest chat']);
    // Chat keeps its own sessions, and the project's session is not repeated there.
    expect(wrapper.findAll(`${SESSIONS} a`).map((link) => link.text())).toEqual(['New session', 'Older chat']);
  });

  it('offers to start a session in an empty project instead of saying it is empty', async () => {
    (api.getProjects as Mock).mockResolvedValue({ data: [{ id: 'p1', project_name: 'Acme', project_path: 'acme' }] });
    (api.getSessions as Mock).mockResolvedValue({ data: [latest] });

    const wrapper = await mountList();
    await wrapper.get('[data-testid="sidebar-projects-toggle"]').trigger('click');

    const link = wrapper.get('[data-testid="sidebar-project-new-session-p1"]');
    expect(link.text()).toBe('New session');
    // The link carries the project, so the chat it starts is already filed there.
    expect(link.attributes('href')).toContain('project=p1');
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

  it('keeps the project group closed until it is asked for', async () => {
    (api.getProjects as Mock).mockResolvedValue({ data: [{ id: 'p1', project_name: 'Acme', project_path: 'acme' }] });
    (api.getSessions as Mock).mockResolvedValue({ data: [latest] });

    const wrapper = await mountList();

    // Chat is what people came for: the unfamiliar group must not push it down.
    expect(wrapper.find('[data-testid="sidebar-project-list"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="sidebar-chat-session-list"]').exists()).toBe(true);
  });
});
