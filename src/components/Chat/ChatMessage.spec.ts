import { i18n } from '@/i18n';
import { useAlertStore } from '@/stores/alertStore';
import { createPinia, setActivePinia } from 'pinia';
import { formatDateTime } from '@/utils/datetime';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatMessage from './ChatMessage.vue';

const created_at = '2026-01-01T00:00:00Z';

// The revert dialog is teleported to the body, so it is outside the wrapper's tree.
const dialog = () => document.querySelector('[data-testid="form-modal-box"]');
const REVERT = '[data-testid="user-message-revert"]';
const ANSWER_COPY = '[data-testid="assistant-message-copy"]';

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function mountMessages(messages: ChatHistoryEntry[]) {
  return mount(ChatMessage, { props: { messages }, global: { plugins: [i18n] } });
}

function expectPadded(component: { classes: () => string[] }, py = 'py-1') {
  expect(component.classes()).toContain('px-4');
  expect(component.classes()).toContain(py);
}

function user(seq: number, text: string, id?: string): ChatHistoryEntry {
  return { seq, role: 'user', data: { role: 'user', content: [{ type: 'text', text }], created_at, id }, created_at };
}

function assistant(seq: number, content: string): ChatHistoryEntry {
  return { seq, role: 'assistant', data: { role: 'assistant', content, created_at }, created_at };
}

function revertibleFlags(wrapper: ReturnType<typeof mountMessages>): (boolean | undefined)[] {
  return wrapper.findAllComponents({ name: 'UserMessage' }).map((component) => (component.props() as { revertible?: boolean }).revertible);
}

describe('ChatMessage', () => {
  it('applies the shared block padding to user messages', () => {
    const messages: ChatHistoryEntry[] = [user(0, 'hi', 'm1')];
    const message = mountMessages(messages).getComponent({ name: 'UserMessage' });
    expectPadded(message, 'py-2');
  });

  it('applies the shared block padding to think, answer and tool parts', () => {
    const messages: ChatHistoryEntry[] = [
      {
        seq: 2,
        role: 'assistant',
        data: {
          role: 'assistant',
          content: 'answer',
          reasoning_content: 'because',
          created_at,
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{}' } }],
        },
        created_at,
      },
    ];
    const wrapper = mountMessages(messages);
    expectPadded(wrapper.getComponent({ name: 'ThinkMessage' }));
    expectPadded(wrapper.getComponent({ name: 'AssistantMessage' }));
    expectPadded(wrapper.getComponent({ name: 'ToolMessage' }));
  });

  it('shows the created time inside the user bubble and under the assistant turn', () => {
    const messages: ChatHistoryEntry[] = [user(0, 'hi', 'm1'), { seq: 1, role: 'assistant', data: { role: 'assistant', content: 'answer', created_at }, created_at }];
    const wrapper = mountMessages(messages);
    expect(wrapper.get('[data-testid="user-message-time"]').text()).toBe(formatDateTime(created_at));
    expect(wrapper.get('[data-testid="assistant-message-time"]').text()).toBe(formatDateTime(created_at));
  });

  it('omits the time when the message carries none', () => {
    const messages: ChatHistoryEntry[] = [{ seq: 0, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'hi' }], created_at: '' }, created_at: '' }];
    const wrapper = mountMessages(messages);
    expect(wrapper.find('[data-testid="user-message-time"]').exists()).toBe(false);
  });

  it('copies an assistant turn and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const wrapper = mountMessages([user(0, 'hi', 'm1'), assistant(1, 'answer')]);

    await wrapper.get(ANSWER_COPY).trigger('click');

    expect(writeText).toHaveBeenCalledWith('answer');
    expect(useAlertStore().alertList.map((item) => item.level)).toEqual(['success']);
  });

  it('leaves out the copy button when an assistant turn has no answer text', () => {
    expect(
      mountMessages([assistant(1, '')])
        .find(ANSWER_COPY)
        .exists(),
    ).toBe(false);
  });

  it('offers revert on every user turn but the opening one', () => {
    const wrapper = mountMessages([user(0, 'one', 'm1'), user(2, 'two', 'm2'), user(4, 'three', 'm3')]);
    expect(revertibleFlags(wrapper)).toEqual([false, true, true]);
  });

  it('withholds revert from a lone user turn', () => {
    expect(revertibleFlags(mountMessages([user(0, 'only', 'm1')]))).toEqual([false]);
  });

  it('withholds revert when the user turns have no app id', () => {
    expect(revertibleFlags(mountMessages([user(0, 'one'), user(2, 'two')]))).toEqual([false, false]);
  });

  it('rebuilds a row whose message changed instead of reusing it', async () => {
    const wrapper = mountMessages([user(0, 'one', 'm1'), user(2, 'two', 'm2')]);
    await wrapper.get(REVERT).trigger('click');
    expect(dialog()).not.toBeNull();

    // A resync after a stop replaces the history wholesale: the row at this
    // position is a different message now, so the dialog it opened must go with
    // the old one rather than stay attached to the position.
    await wrapper.setProps({ messages: [user(0, 'one', 'm1'), user(2, 'three', 'm3')] });

    expect(dialog()).toBeNull();
  });

  it('keeps a row while its message keeps its id', async () => {
    const wrapper = mountMessages([user(0, 'one', 'm1'), user(2, 'two', 'm2')]);
    await wrapper.get(REVERT).trigger('click');

    await wrapper.setProps({ messages: [user(0, 'one', 'm1'), user(2, 'two again', 'm2')] });

    expect(dialog()).not.toBeNull();
  });
});
