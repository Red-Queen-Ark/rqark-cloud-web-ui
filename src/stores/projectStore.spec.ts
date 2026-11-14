import * as api from '@/api';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useProjectStore } from './projectStore';

vi.mock('@/api', () => ({ getProjects: vi.fn() }));

let pinia: Pinia;

describe('projectStore', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  it('keeps the list the cloud returns', async () => {
    const projects = [
      { id: 'p1', project_name: 'acme', project_path: 'acme' },
      { id: 'p2', project_name: 'other', project_path: 'other/nested' },
    ];
    (api.getProjects as Mock).mockResolvedValue({ data: projects });

    const store = useProjectStore();
    await store.load();

    expect(store.projects).toEqual(projects);
    expect(store.loaded).toBe(true);
    expect(store.nameOf('p2')).toBe('other');
    expect(store.byId('p2')?.project_path).toBe('other/nested');
  });

  it('keeps the previous list when the load fails', async () => {
    (api.getProjects as Mock).mockResolvedValueOnce({ data: [{ id: 'p1', project_name: 'acme' }] });
    const store = useProjectStore();
    await store.load();

    (api.getProjects as Mock).mockRejectedValueOnce(new Error('offline'));
    await store.load();

    expect(store.projects).toEqual([{ id: 'p1', project_name: 'acme' }]);
  });

  it('reports no name for a project it does not know', () => {
    const store = useProjectStore();

    expect(store.nameOf('missing')).toBe('');
    expect(store.byId(null)).toBeUndefined();
  });
});
