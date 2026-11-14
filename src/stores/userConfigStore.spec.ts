import * as api from '@/api';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useUserConfigStore } from './userConfigStore';

vi.mock('@/api', () => ({ getUserConfig: vi.fn(), putUserConfigByKey: vi.fn() }));

let pinia: Pinia;

describe('userConfigStore project order', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    (api.putUserConfigByKey as Mock).mockResolvedValue({ data: {} });
  });

  it('reads the stored order on load', async () => {
    (api.getUserConfig as Mock).mockResolvedValue({
      data: [{ key: 'project_order', value: { order: ['p2', 'p1'] } }],
    });

    const store = useUserConfigStore();
    await store.load();

    expect(store.projectOrder).toEqual(['p2', 'p1']);
  });

  it('leaves the order unset when nothing is stored', async () => {
    (api.getUserConfig as Mock).mockResolvedValue({ data: [] });

    const store = useUserConfigStore();
    await store.load();

    expect(store.projectOrder).toBeUndefined();
  });

  it('writes the order under the project_order key', async () => {
    const store = useUserConfigStore();
    const saved = await store.saveProjectOrder(['p2', 'p1']);

    expect(saved).toBe(true);
    expect(store.projectOrder).toEqual(['p2', 'p1']);
    expect(api.putUserConfigByKey).toHaveBeenCalledWith({
      path: { key: 'project_order' },
      body: { value: { order: ['p2', 'p1'] } },
    });
  });

  it('puts the previous order back when the write fails', async () => {
    (api.getUserConfig as Mock).mockResolvedValue({
      data: [{ key: 'project_order', value: { order: ['p1', 'p2'] } }],
    });
    const store = useUserConfigStore();
    await store.load();

    (api.putUserConfigByKey as Mock).mockResolvedValue({ error: { message: 'nope' } });
    const saved = await store.saveProjectOrder(['p2', 'p1']);

    expect(saved).toBe(false);
    expect(store.projectOrder).toEqual(['p1', 'p2']);
  });

  it('keeps the order a write is setting when a poll lands mid-flight', async () => {
    (api.getUserConfig as Mock).mockResolvedValue({
      data: [{ key: 'project_order', value: { order: ['p1', 'p2'] } }],
    });
    const store = useUserConfigStore();
    await store.load();

    let releasePut!: (value: unknown) => void;
    (api.putUserConfigByKey as Mock).mockReturnValue(new Promise((resolve) => (releasePut = resolve)));
    const saving = store.saveProjectOrder(['p2', 'p1']);

    (api.getUserConfig as Mock).mockResolvedValue({
      data: [{ key: 'project_order', value: { order: ['p1', 'p2'] } }],
    });
    await store.refreshProjectOrder();

    expect(store.projectOrder).toEqual(['p2', 'p1']);
    releasePut({ data: {} });
    await saving;
  });
});
