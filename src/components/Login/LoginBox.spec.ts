import { i18n } from '@/i18n';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import LoginBox from './LoginBox.vue';

const Blank = defineComponent({ template: '<div />' });

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/:lang/login', name: 'login', component: Blank },
      { path: '/:lang/register', name: 'register', component: Blank },
      { path: '/:lang/forgot-password', name: 'forgotPassword', component: Blank },
    ],
  });
}

describe('LoginBox', () => {
  it('renders the credentials form', async () => {
    const router = createTestRouter();
    await router.push('/en/login');
    await router.isReady();

    const wrapper = mount(LoginBox, { global: { plugins: [i18n, router] } });

    expect(wrapper.find('#login-username').exists()).toBe(true);
    expect(wrapper.find('#login-password').exists()).toBe(true);
  });

  it('emits login on submit', async () => {
    const router = createTestRouter();
    await router.push('/en/login');
    await router.isReady();

    const wrapper = mount(LoginBox, { global: { plugins: [i18n, router] } });
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('login')).toHaveLength(1);
  });

  it('hides the registration link when the deployment forbids it', async () => {
    const router = createTestRouter();
    await router.push('/en/login');
    await router.isReady();

    const wrapper = mount(LoginBox, { global: { plugins: [i18n, router] } });

    expect(wrapper.text()).not.toContain('No account yet?');
  });

  it('shows the registration link when the deployment allows it', async () => {
    const router = createTestRouter();
    await router.push('/en/login');
    await router.isReady();

    const wrapper = mount(LoginBox, { props: { allowRegistration: true }, global: { plugins: [i18n, router] } });

    expect(wrapper.text()).toContain('No account yet?');
  });

  it('disables the submit button while loading', async () => {
    const router = createTestRouter();
    await router.push('/en/login');
    await router.isReady();

    const wrapper = mount(LoginBox, { props: { loading: true }, global: { plugins: [i18n, router] } });

    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();
  });
});
