import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { defineComponent } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { i18n } from '@/i18n';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import WorkSpacePage from './WorkSpacePage.vue';

const api = vi.hoisted(() => ({
  listWorkspace: vi.fn(),
  downloadWorkspaceFile: vi.fn(),
  downloadWorkspaceArchive: vi.fn(),
  uploadWorkspaceFiles: vi.fn(),
  writeWorkspaceFile: vi.fn(),
  makeWorkspaceDirectory: vi.fn(),
  moveWorkspaceEntry: vi.fn(),
  deleteWorkspaceEntry: vi.fn(),
}));

vi.mock('@/api-client/workspace', () => api);

class FakeWorkspaceError extends Error {
  public readonly error = { code: 'FILE_NOT_FOUND', message: 'not found' };
}

const FILE = { name: 'notes.md', path: 'notes.md', type: 'file', size: 12, mtime: 1_782_000_000 };
const FOLDER = { name: 'docs', path: 'docs', type: 'dir', size: 4096, mtime: 1_782_000_000 };

const Blank = defineComponent({ template: '<div />' });

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:lang/workspace', name: 'workspace', component: Blank }],
  });
}

let pinia: Pinia;

async function mountPage(fullPath = '/en/workspace') {
  const router = createTestRouter();
  await router.push(fullPath);
  await router.isReady();
  const wrapper = mount(WorkSpacePage, { global: { plugins: [i18n, router, pinia] } });
  await flushPromises();
  return { wrapper, router };
}

describe('WorkSpacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    api.listWorkspace.mockResolvedValue({ path: '', entries: [FILE, FOLDER] });
  });

  it('lists the current folder', async () => {
    const { wrapper } = await mountPage();

    expect(api.listWorkspace).toHaveBeenCalledWith('', false);
    expect(wrapper.get('[data-testid="workspace-row-notes.md"]').text()).toContain('notes.md');
    expect(wrapper.get('[data-testid="workspace-row-docs"]').text()).toContain('docs');
  });

  it('opens a folder by pushing its path into the query', async () => {
    api.listWorkspace.mockImplementation(async (path: string) => ({ path, entries: path === 'docs' ? [] : [FILE, FOLDER] }));
    const { wrapper, router } = await mountPage();

    await wrapper.get('[data-testid="workspace-row-docs"] button').trigger('click');
    await flushPromises();

    expect(useWorkspaceStore().path).toBe('docs');
    expect(api.listWorkspace).toHaveBeenLastCalledWith('docs', false);
    expect(router.currentRoute.value.query.path).toBe('docs');
  });

  it('starts on the folder named in the query', async () => {
    api.listWorkspace.mockResolvedValue({ path: 'docs', entries: [] });

    await mountPage('/en/workspace?path=docs');

    expect(useWorkspaceStore().path).toBe('docs');
    expect(api.listWorkspace).toHaveBeenCalledWith('docs', false);
  });

  it('reloads with hidden files when the toggle is pressed', async () => {
    const { wrapper } = await mountPage();

    await wrapper.get('[data-testid="workspace-toggle-hidden"]').trigger('click');
    await flushPromises();

    expect(useWorkspaceStore().showHidden).toBe(true);
    expect(api.listWorkspace).toHaveBeenLastCalledWith('', true);
  });

  it('filters the visible rows with the search box', async () => {
    const { wrapper } = await mountPage();

    await wrapper.get('[data-testid="workspace-search"]').setValue('note');

    expect(wrapper.find('[data-testid="workspace-row-notes.md"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="workspace-row-docs"]').exists()).toBe(false);
  });

  it('creates a folder under the current path', async () => {
    const { wrapper } = await mountPage();
    api.makeWorkspaceDirectory.mockResolvedValue({ ...FOLDER, name: 'reports', path: 'reports' });

    await wrapper.get('[data-testid="workspace-new-folder"]').trigger('click');
    await wrapper.get('[data-testid="workspace-item-name"]').setValue('reports');
    await wrapper.get('[data-testid="form-modal"]').findAll('button')[1].trigger('click');
    await flushPromises();

    expect(api.makeWorkspaceDirectory).toHaveBeenCalledWith('reports');
  });

  it('creates an empty file under the current path', async () => {
    const { wrapper } = await mountPage();

    await wrapper.get('[data-testid="workspace-new-file"]').trigger('click');
    await wrapper.get('[data-testid="workspace-item-name"]').setValue('fresh.txt');
    await wrapper.get('[data-testid="form-modal"]').findAll('button')[1].trigger('click');
    await flushPromises();

    expect(api.writeWorkspaceFile).toHaveBeenCalledWith('fresh.txt', '');
  });

  it('deletes an entry after the confirm dialog', async () => {
    const { wrapper } = await mountPage();

    await wrapper.get('[data-testid="workspace-row-notes.md"] [data-testid="workspace-entry-menu-button"]').trigger('click');
    await wrapper.get('[data-testid="workspace-row-notes.md"] [data-testid="workspace-entry-delete"]').trigger('click');
    await wrapper.get('[data-testid="form-modal"]').findAll('button')[1].trigger('click');
    await flushPromises();

    expect(api.deleteWorkspaceEntry).toHaveBeenCalledWith('notes.md');
  });

  it('falls back to the root when the stored folder is gone', async () => {
    useWorkspaceStore().setPath('gone');
    api.listWorkspace.mockImplementation(async (path: string) => {
      if (path === 'gone') {
        throw new FakeWorkspaceError('not found');
      }
      return { path, entries: [] };
    });

    await mountPage('/en/workspace?path=gone');
    await flushPromises();

    expect(useWorkspaceStore().path).toBe('');
  });
});
