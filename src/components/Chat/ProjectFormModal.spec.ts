import { i18n } from '@/i18n';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as workspace from '@/api-client/workspace';
import ProjectFormModal from './ProjectFormModal.vue';

vi.mock('@/api-client/workspace', () => ({ listWorkspace: vi.fn() }));

function mountModal(project: { project_name?: string; project_path?: string } | null = null) {
  return mount(ProjectFormModal, { props: { project }, global: { plugins: [i18n] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  (workspace.listWorkspace as Mock).mockResolvedValue({ path: '', entries: [] });
});

describe('ProjectFormModal', () => {
  it('browses the volume root so a project can be picked from it', async () => {
    (workspace.listWorkspace as Mock).mockResolvedValue({
      path: '',
      entries: [
        { name: 'acme', path: 'acme', type: 'dir', size: 0, mtime: 0 },
        { name: 'notes.txt', path: 'notes.txt', type: 'file', size: 3, mtime: 0 },
      ],
    });

    const wrapper = mountModal();
    await flushPromises();

    expect(workspace.listWorkspace).toHaveBeenCalledWith('');
    // Only folders are offered: a file cannot be a project.
    expect(wrapper.find('[data-testid="project-folder-acme"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="project-folder-notes.txt"]').exists()).toBe(false);
  });

  it('follows the folder into the name until the user types their own', async () => {
    (workspace.listWorkspace as Mock).mockImplementation(async (path: string) => ({
      path,
      entries: path === '' ? [{ name: 'acme', path: 'acme', type: 'dir', size: 0, mtime: 0 }] : [{ name: 'api', path: 'acme/api', type: 'dir', size: 0, mtime: 0 }],
    }));
    const wrapper = mountModal();
    await flushPromises();

    await wrapper.get('[data-testid="project-folder-acme"]').trigger('click');
    await flushPromises();
    expect((wrapper.get('[data-testid="project-name"]').element as HTMLInputElement).value).toBe('acme');

    await wrapper.get('[data-testid="project-name"]').setValue('My API');
    await wrapper.get('[data-testid="project-folder-acme/api"]').trigger('click');
    await flushPromises();
    expect((wrapper.get('[data-testid="project-name"]').element as HTMLInputElement).value).toBe('My API');
  });

  it('sends the trimmed name and the normalised path', async () => {
    const wrapper = mountModal();
    await flushPromises();

    await wrapper.get('[data-testid="project-name"]').setValue('  Acme API ');
    await wrapper.get('[data-testid="project-path"]').setValue('acme//api/');
    await wrapper.get('[data-testid="form-modal"] .btn-primary').trigger('click');

    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ project_name: 'Acme API', project_path: 'acme/api' }]);
  });

  it('refuses a path that would leave the volume', async () => {
    const wrapper = mountModal();
    await flushPromises();

    await wrapper.get('[data-testid="project-name"]').setValue('Acme');
    await wrapper.get('[data-testid="project-path"]').setValue('../etc');
    await wrapper.get('[data-testid="form-modal"] .btn-primary').trigger('click');

    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.get('[data-testid="project-form-error"]').text()).toBe('The path must not climb out with "..".');
  });

  it('keeps the stored name when renaming', async () => {
    const wrapper = mountModal({ project_name: 'Acme', project_path: 'acme' });
    await flushPromises();

    expect((wrapper.get('[data-testid="project-name"]').element as HTMLInputElement).value).toBe('Acme');
    expect((wrapper.get('[data-testid="project-path"]').element as HTMLInputElement).value).toBe('acme');
  });
});
