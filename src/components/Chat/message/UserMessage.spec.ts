import { i18n } from '@/i18n';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import UserMessage from './UserMessage.vue';

const created_at = '2026-01-01T00:00:00Z';
const REVERT = '[data-testid="user-message-revert"]';
const BUBBLE = '[data-testid="user-message"]';

// The dialog is teleported to the body, so it is outside the wrapper's own tree.
const dialog = () => document.querySelector('[data-testid="form-modal-box"]');

function message(id?: string): ChatUserMessage {
  return { role: 'user', content: [{ type: 'text', text: 'hello' }], created_at, id };
}

function mountMessage(props: { revertible?: boolean; busy?: boolean; id?: string } = {}) {
  return mount(UserMessage, { props: { message: message(props.id), revertible: props.revertible, busy: props.busy }, global: { plugins: [i18n] } });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('UserMessage', () => {
  it('right-aligns the bubble within a fixed, max-width capped box', () => {
    const bubble = mountMessage().get(BUBBLE);
    expect(bubble.classes()).toContain('ms-auto');
    expect(bubble.classes()).toContain('w-96');
    expect(bubble.classes()).toContain('max-w-full');
  });

  it('hides the revert button unless the message can be reverted', () => {
    expect(mountMessage({ revertible: false, id: 'm1' }).find(REVERT).exists()).toBe(false);
  });

  it('asks before reverting and emits the message id on confirm', async () => {
    const wrapper = mountMessage({ revertible: true, id: 'm1' });

    await wrapper.get(REVERT).trigger('click');
    expect(dialog()).not.toBeNull();
    expect(wrapper.emitted('revert')).toBeUndefined();

    (dialog()?.querySelector('.btn-warning') as HTMLButtonElement).click();
    await flushPromises();

    expect(wrapper.emitted('revert')).toEqual([['m1']]);
    expect(dialog()).toBeNull();
  });

  it('keeps the message when the dialog is cancelled', async () => {
    const wrapper = mountMessage({ revertible: true, id: 'm1' });

    await wrapper.get(REVERT).trigger('click');
    (dialog()?.querySelector('.btn-ghost') as HTMLButtonElement).click();
    await flushPromises();

    expect(wrapper.emitted('revert')).toBeUndefined();
    expect(dialog()).toBeNull();
  });

  it('disables the revert button while the chat is busy', () => {
    expect(mountMessage({ revertible: true, busy: true, id: 'm1' }).get(REVERT).attributes('disabled')).toBeDefined();
  });
});
