import * as api from '@/api';
import { i18n } from '@/i18n';
import { useProjectStore } from '@/stores/projectStore';
import { useUserConfigStore } from '@/stores/userConfigStore';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import SidebarProjectsList from './SidebarProjectsList.vue';

vi.mock('@/api', () => ({
  deleteProjectsByUuid: vi.fn(),
  getProjects: vi.fn(),
  getUserConfig: vi.fn(),
  postProjects: vi.fn(),
  putProjectsByUuid: vi.fn(),
  putUserConfigByKey: vi.fn(),
}));

const projects = [
  { id: 'p1', project_name: 'acme', project_path: 'acme' },
  { id: 'p2', project_name: 'other', project_path: 'other' },
];

let pinia: Pinia;

const dataTransfer = () => ({
  setData: vi.fn(),
  getData: vi.fn(),
  effectAllowed: '',
  dropEffect: '',
});

async function mountList() {
  const wrapper = mount(SidebarProjectsList, {
    props: { sessions: [], lang: 'en' },
    global: { plugins: [i18n, pinia] },
  });
  await flushPromises();
  await wrapper.get('[data-testid="sidebar-projects-toggle"]').trigger('click');
  return wrapper;
}

function names(wrapper: Awaited<ReturnType<typeof mountList>>): string[] {
  return wrapper.findAll('[data-testid^="sidebar-project-toggle-"]').map((row) => row.text().replace(/\s+/g, ' ').trim());
}

describe('SidebarProjectsList reordering', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    (api.putUserConfigByKey as Mock).mockResolvedValue({ data: {} });
    useProjectStore().setProjects([...projects]);
  });

  it('moves the dragged project to the drop target and stores the order', async () => {
    const wrapper = await mountList();
    const transfer = dataTransfer();

    await wrapper.get('[data-testid="sidebar-project-row-p1"]').trigger('dragstart', { dataTransfer: transfer });
    await wrapper.get('[data-testid="sidebar-project-row-p2"]').trigger('dragover', { dataTransfer: transfer });
    await wrapper.get('[data-testid="sidebar-project-row-p2"]').trigger('drop', { dataTransfer: transfer });
    await flushPromises();

    expect(api.putUserConfigByKey).toHaveBeenCalledWith({
      path: { key: 'project_order' },
      body: { value: { order: ['p2', 'p1'] } },
    });
    expect(useProjectStore().sorted.map((project) => project.id)).toEqual(['p2', 'p1']);
  });

  it('puts the rows back and reports it when the write fails', async () => {
    (api.putUserConfigByKey as Mock).mockResolvedValue({ error: { message: 'nope' } });
    const wrapper = await mountList();
    const store = useUserConfigStore();
    const transfer = dataTransfer();

    await wrapper.get('[data-testid="sidebar-project-row-p1"]').trigger('dragstart', { dataTransfer: transfer });
    await wrapper.get('[data-testid="sidebar-project-row-p2"]').trigger('drop', { dataTransfer: transfer });
    await flushPromises();

    expect(store.projectOrder).toBeUndefined();
    expect(useProjectStore().sorted.map((project) => project.id)).toEqual(['p1', 'p2']);
    expect(wrapper.text()).toContain('acme');
  });

  it('does nothing when a row is dropped on itself', async () => {
    const wrapper = await mountList();
    const transfer = dataTransfer();

    await wrapper.get('[data-testid="sidebar-project-row-p1"]').trigger('dragstart', { dataTransfer: transfer });
    await wrapper.get('[data-testid="sidebar-project-row-p1"]').trigger('drop', { dataTransfer: transfer });
    await flushPromises();

    expect(api.putUserConfigByKey).not.toHaveBeenCalled();
  });

  it('shows the stored order the config sync hands over', async () => {
    const wrapper = await mountList();
    useProjectStore().applyOrder(['p2', 'p1']);
    await flushPromises();

    expect(names(wrapper)).toEqual(['other0', 'acme0']);
  });
});
