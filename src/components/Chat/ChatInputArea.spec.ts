import { i18n } from '@/i18n';
import type { ChatStatus } from '@/config/chatStatus';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import ChatInputArea from './ChatInputArea.vue';

function mountArea(overrides: { agents?: string[]; providers?: { name?: string; model_name?: string }[]; status?: ChatStatus } = {}) {
  return mount(ChatInputArea, {
    props: {
      agents: overrides.agents ?? ['researcher'],
      providers: overrides.providers ?? [{ name: 'openai', model_name: 'gpt-5' }],
      status: overrides.status,
    },
    global: { plugins: [i18n] },
  });
}

describe('ChatInputArea', () => {
  it('shows no status dot before a connection', () => {
    expect(mountArea().find('.status').exists()).toBe(false);
  });

  it('shows a warning dot while connecting', () => {
    expect(mountArea({ status: 'connecting' }).get('.status').classes()).toContain('status-warning');
  });

  it('shows a success dot once connected', () => {
    expect(mountArea({ status: 'connected' }).get('.status').classes()).toContain('status-success');
  });

  it('shows an error dot when the connection dropped', () => {
    expect(mountArea({ status: 'error' }).get('.status').classes()).toContain('status-error');
  });

  it('keeps send disabled until something is typed', async () => {
    const wrapper = mountArea();
    const send = wrapper.get('[data-testid="chat-send"]');
    expect(send.attributes('disabled')).toBeDefined();

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hi';
    await input.trigger('input');

    expect(send.attributes('disabled')).toBeUndefined();
  });

  it('emits the typed turn with the chosen agent and provider', async () => {
    const wrapper = mountArea();

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ content: 'hello', agent: 'researcher', provider: 'openai' }]);
  });

  it('falls back to the model name for a provider without a name', async () => {
    const wrapper = mountArea({ providers: [{ model_name: 'gpt-5' }] });

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ content: 'hello', agent: 'researcher', provider: 'gpt-5' }]);
  });

  it('clears the editor and disables send when the parent asks', async () => {
    const wrapper = mountArea();

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');

    const area = wrapper.vm as unknown as { clear: () => void };
    area.clear();
    await nextTick();

    expect(input.element.textContent).toBe('');
    expect(wrapper.get('[data-testid="chat-send"]').attributes('disabled')).toBeDefined();
  });
});
