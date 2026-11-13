import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import LoginServerSettings from './LoginServerSettings.vue';

beforeEach(() => {
  setActivePinia(createPinia());
});

function mountSettings() {
  return mount(LoginServerSettings, { global: { plugins: [i18n] } });
}

describe('LoginServerSettings', () => {
  it('shows the settings button and no panel', () => {
    const wrapper = mountSettings();

    expect(wrapper.find('#login-server-settings').exists()).toBe(true);
    expect(wrapper.find('#settings-api-base').exists()).toBe(false);
  });

  it('opens the panel from the button', async () => {
    const wrapper = mountSettings();

    await wrapper.find('#login-server-settings').trigger('click');

    expect(wrapper.find('#settings-api-base').exists()).toBe(true);
    expect(wrapper.find('#settings-agent-api-base').exists()).toBe(true);
  });

  it('opens the panel when a caller asks for it', async () => {
    const wrapper = mountSettings();

    wrapper.vm.open();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('#settings-api-base').exists()).toBe(true);
  });

  it('closes the panel from its close button', async () => {
    const wrapper = mountSettings();

    await wrapper.find('#login-server-settings').trigger('click');
    await wrapper.find('#server-settings-close').trigger('click');

    expect(wrapper.find('#settings-api-base').exists()).toBe(false);
    expect(wrapper.find('#login-server-settings').exists()).toBe(true);
  });
});
