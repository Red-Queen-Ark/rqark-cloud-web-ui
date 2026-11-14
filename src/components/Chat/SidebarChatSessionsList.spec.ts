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

    // The shared create action sits above both groups; Chat lists only the
    // sessions that belong to no project, and one with no title says so.
    expect(wrapper.findAll(`${SESSIONS} a`).map((link) => link.text())).toEqual(['Latest chat', 'Untitled session', 'Older chat']);
  });

  it('keeps the create action above the groups', async () => {
    (api.getSessions as Mock).mockResolvedValue({ data: [latest] });

    const wrapper = await mountList();

    const create = wrapper.get('[data-testid="sidebar-chat-new"]');
    expect(create.text()).toBe('New session');
    // The plus icon marks it as an add action, and it is not inside Chat.
    expect(create.find('svg').exists()).toBe(true);
    expect(wrapper.find(`${SESSIONS} [data-testid="sidebar-chat-new"]`).exists()).toBe(false);
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

    const active = wrapper.findAll('a.menu-active');
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
    await wrapper.get('[data-testid="sidebar-project-toggle-p1"]').trigger('click');

    const inProject = wrapper.findAll('[data-testid="sidebar-project-sessions-p1"] a');
    expect(inProject.map((link) => link.text())).toEqual(['Latest chat']);
    // Chat keeps its own sessions, and the project's session is not repeated there.
    expect(wrapper.findAll(`${SESSIONS} a`).map((link) => link.text())).toEqual(['Older chat']);
  });

  it('says an empty project has no session instead of offering a create action', async () => {
    (api.getProjects as Mock).mockResolvedValue({ data: [{ id: 'p1', project_name: 'Acme', project_path: 'acme' }] });
    (api.getSessions as Mock).mockResolvedValue({ data: [latest] });

    const wrapper = await mountList();
    await wrapper.get('[data-testid="sidebar-projects-toggle"]').trigger('click');
    await wrapper.get('[data-testid="sidebar-project-toggle-p1"]').trigger('click');

    const empty = wrapper.get('[data-testid="sidebar-project-empty-p1"]');
    expect(empty.text()).toBe('No session yet');
    // The shared New session is the only create action, so the project does not repeat it.
    expect(wrapper.find('[data-testid="sidebar-project-sessions-p1"] a').exists()).toBe(false);
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

  it('keeps both levels closed until they are asked for', async () => {
    (api.getProjects as Mock).mockResolvedValue({ data: [{ id: 'p1', project_name: 'Acme', project_path: 'acme' }] });
    (api.getSessions as Mock).mockResolvedValue({ data: [{ ...latest, project_id: 'p1' }] });

    const wrapper = await mountList();

    // Chat is what people came for: the unfamiliar group must not push it down.
    expect(wrapper.find('[data-testid="sidebar-project-list"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="sidebar-chat-session-list"]').exists()).toBe(true);

    await wrapper.get('[data-testid="sidebar-projects-toggle"]').trigger('click');

    // The project rows appear, and each one is still shut.
    expect(wrapper.find('[data-testid="sidebar-project-p1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sidebar-project-sessions-p1"]').exists()).toBe(false);
  });

  it('opens the project the chat being read belongs to', async () => {
    (api.getProjects as Mock).mockResolvedValue({ data: [{ id: 'p1', project_name: 'Acme', project_path: 'acme' }] });
    (api.getSessions as Mock).mockResolvedValue({ data: [{ ...latest, project_id: 'p1' }] });

    const wrapper = await mountList(`/en/chat/${latest.id}`);

    // A reload onto a chat shows where that chat lives, without a click.
    expect(wrapper.find('[data-testid="sidebar-project-sessions-p1"]').exists()).toBe(true);
  });

  it('leaves the group closed when the chat belongs to no project', async () => {
    (api.getProjects as Mock).mockResolvedValue({ data: [{ id: 'p1', project_name: 'Acme', project_path: 'acme' }] });
    (api.getSessions as Mock).mockResolvedValue({ data: [latest] });

    const wrapper = await mountList(`/en/chat/${latest.id}`);

    expect(wrapper.find('[data-testid="sidebar-project-list"]').exists()).toBe(false);
  });

  it('does not reopen a project the user closed while reading it', async () => {
    (api.getProjects as Mock).mockResolvedValue({ data: [{ id: 'p1', project_name: 'Acme', project_path: 'acme' }] });
    (api.getSessions as Mock).mockResolvedValue({ data: [{ ...latest, project_id: 'p1' }] });

    const wrapper = await mountList(`/en/chat/${latest.id}`);
    await wrapper.get('[data-testid="sidebar-project-toggle-p1"]').trigger('click');
    expect(wrapper.find('[data-testid="sidebar-project-sessions-p1"]').exists()).toBe(false);

    // The poll republishes the list; that is not a reason to undo the close.
    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();

    expect(wrapper.find('[data-testid="sidebar-project-sessions-p1"]').exists()).toBe(false);
  });
});
