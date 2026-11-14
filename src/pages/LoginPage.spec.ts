import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { defineComponent } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { i18n } from '@/i18n';
import LoginPage from './LoginPage.vue';

const api = vi.hoisted(() => ({ getSystemConfig2: vi.fn() }));

vi.mock('@/api', () => ({ getSystemConfig2: api.getSystemConfig2 }));

const Blank = defineComponent({ template: '<div />' });

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/:lang/login', name: 'login', component: Blank },
      { path: '/:lang/forgot-password', name: 'forgotPassword', component: Blank },
      { path: '/:lang/register', name: 'register', component: Blank },
      { path: '/:lang', name: 'home', component: Blank },
    ],
  });
}

let pinia: Pinia;

function desktop(): void {
  (window as unknown as { _wails?: unknown })._wails = {};
}

function browser(): void {
  delete (window as unknown as { _wails?: unknown })._wails;
}

async function mountLogin() {
  const router = createTestRouter();
  await router.push('/en/login');
  await router.isReady();
  const wrapper = mount(LoginPage, { global: { plugins: [i18n, router, pinia] } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  api.getSystemConfig2.mockResolvedValue({ data: { allow_self_registration: false } });
  browser();
});

describe('LoginPage', () => {
  it('keeps the server settings out of the way on the web', async () => {
    const wrapper = await mountLogin();
    expect(wrapper.find('#login-server-settings').exists()).toBe(false);
  });

  it('offers the server settings before the user is logged in on the desktop', async () => {
    desktop();
    const wrapper = await mountLogin();
    expect(wrapper.find('#login-server-settings').exists()).toBe(true);
  });

  it('opens the server settings on its own when the backend cannot be reached', async () => {
    desktop();
    api.getSystemConfig2.mockRejectedValue(new Error('offline'));
    const wrapper = await mountLogin();

    expect(wrapper.find('#settings-api-base').exists()).toBe(true);
  });

  it('keeps the login form clean when the web build cannot reach the backend', async () => {
    api.getSystemConfig2.mockRejectedValue(new Error('offline'));
    const wrapper = await mountLogin();

    expect(wrapper.find('#settings-api-base').exists()).toBe(false);
  });

  it('opens the server settings from the login page', async () => {
    desktop();
    const wrapper = await mountLogin();

    await wrapper.find('#login-server-settings').trigger('click');
    await flushPromises();

    expect(wrapper.find('#settings-api-base').exists()).toBe(true);
    expect(wrapper.find('#settings-agent-api-base').exists()).toBe(true);
  });
});
