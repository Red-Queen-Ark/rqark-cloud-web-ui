import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { resetSpeechAvailability, useSpeechAvailability } from './useSpeechAvailability';

const Host = defineComponent({
  setup() {
    const { available, load } = useSpeechAvailability();
    void load();
    return { available };
  },
  template: '<div>{{ available }}</div>',
});

beforeEach(() => {
  resetSpeechAvailability();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSpeechAvailability', () => {
  it('starts hidden so nothing flashes before the probe answers', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<never>(() => undefined)));

    const wrapper = mount(Host);

    expect(wrapper.vm.available).toBe(false);
  });

  it('shows the microphone once the agent cloud confirms the speech routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(Host);
    await flushPromises();

    expect(wrapper.vm.available).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/agent-api/asr/health', expect.anything());
  });

  it('stays hidden when the route is not mounted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const wrapper = mount(Host);
    await flushPromises();

    expect(wrapper.vm.available).toBe(false);
  });

  it('stays hidden when the probe never reaches the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    const wrapper = mount(Host);
    await flushPromises();

    expect(wrapper.vm.available).toBe(false);
  });

  it('probes once per page load', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    mount(Host);
    await flushPromises();
    mount(Host);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
