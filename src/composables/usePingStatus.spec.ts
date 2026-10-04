import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { usePingStatus } from './usePingStatus';

const Host = defineComponent({
  setup() {
    const { status } = usePingStatus();
    return { status };
  },
  template: '<div>{{ status }}</div>',
});

function mountHost() {
  return mount(Host);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePingStatus', () => {
  it('pings the agent cloud and reports it as connected', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountHost();
    expect(wrapper.vm.status).toBe('connecting');

    await flushPromises();

    expect(wrapper.vm.status).toBe('connected');
    expect(fetchMock).toHaveBeenCalledWith('/agent-api/ping', expect.anything());
  });

  it('reports an unreachable agent cloud when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const wrapper = mountHost();
    await flushPromises();

    expect(wrapper.vm.status).toBe('error');
  });

  it('reports an error when the agent cloud answers with a failure status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const wrapper = mountHost();
    await flushPromises();

    expect(wrapper.vm.status).toBe('error');
  });
});
