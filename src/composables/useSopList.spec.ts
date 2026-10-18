import * as api from '@/api';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { resetSopList, useSopList } from './useSopList';

vi.mock('@/api', () => ({
  getSops: vi.fn(),
}));

describe('useSopList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSopList();
  });

  it('stores the sops the endpoint answers', async () => {
    (api.getSops as Mock).mockResolvedValue({ data: { items: [{ slug: 'trip-itinerary', title: 'Trip itinerary' }] } });

    const { sops, load } = useSopList();
    await load();

    expect(sops.value.map((sop) => sop.slug)).toEqual(['trip-itinerary']);
  });

  it('asks once and serves the cache afterwards', async () => {
    (api.getSops as Mock).mockResolvedValue({ data: { items: [] } });

    await useSopList().load();
    await useSopList().load();

    expect(api.getSops).toHaveBeenCalledTimes(1);
  });

  it('shares one request between callers that load at the same time', async () => {
    (api.getSops as Mock).mockResolvedValue({ data: { items: [] } });

    await Promise.all([useSopList().load(), useSopList().load()]);

    expect(api.getSops).toHaveBeenCalledTimes(1);
  });

  it('stays empty and silent when the endpoint answers an error', async () => {
    (api.getSops as Mock).mockResolvedValue({ error: { error: { code: 'NOT_FOUND', message: 'Not found.' } } });

    const { sops, load } = useSopList();
    await load();

    expect(sops.value).toEqual([]);
  });

  it('stays empty and silent when the request throws', async () => {
    (api.getSops as Mock).mockRejectedValue(new Error('offline'));

    const { sops, load } = useSopList();
    await expect(load()).resolves.toBeUndefined();

    expect(sops.value).toEqual([]);
  });
});
