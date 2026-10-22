import { i18n } from '@/i18n';
import { useAlertStore } from '@/stores/alertStore';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserMessage from './UserMessage.vue';

const created_at = '2026-01-01T00:00:00Z';
const REVERT = '[data-testid="user-message-revert"]';
const COPY = '[data-testid="user-message-copy"]';
const BUBBLE = '[data-testid="user-message"]';

// The dialog is teleported to the body, so it is outside the wrapper's own tree.
const dialog = () => document.querySelector('[data-testid="form-modal-box"]');

function message(id?: string): ChatUserMessage {
  return { role: 'user', content: [{ type: 'text', text: 'hello' }], created_at, id };
}

function mountMessage(props: { revertible?: boolean; busy?: boolean; id?: string } = {}) {
  return mount(UserMessage, { props: { message: message(props.id), revertible: props.revertible, busy: props.busy }, global: { plugins: [i18n] } });
}

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('UserMessage', () => {
  it('right-aligns the bubble and lets it hug its text up to a share of the column', () => {
    const bubble = mountMessage().get(BUBBLE);
    expect(bubble.classes()).toContain('ms-auto');
    expect(bubble.classes()).toContain('w-fit');
    expect(bubble.classes()).toContain('min-w-[min(24rem,90%)]');
    expect(bubble.classes()).toContain('max-w-[90%]');
  });

  it('copies the text parts of the message and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const alertStore = useAlertStore();

    await mountMessage().get(COPY).trigger('click');

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(alertStore.alertList.map((item) => item.level)).toEqual(['success']);
  });

  it('reports a clipboard refusal instead of claiming success', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const alertStore = useAlertStore();

    await mountMessage().get(COPY).trigger('click');

    expect(alertStore.alertList.map((item) => item.level)).toEqual(['error']);
  });

  it('hides the copy button when the message has no text', () => {
    const wrapper = mount(UserMessage, {
      props: { message: { role: 'user', content: [{ type: 'image_url', image_url: { url: 'a.png' } }], created_at } },
      global: { plugins: [i18n] },
    });
    expect(wrapper.find(COPY).exists()).toBe(false);
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
