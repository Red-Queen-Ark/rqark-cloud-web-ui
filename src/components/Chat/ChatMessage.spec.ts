import { i18n } from '@/i18n';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ChatMessage from './ChatMessage.vue';

const created_at = '2026-01-01T00:00:00Z';

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

function revertibleFlags(wrapper: ReturnType<typeof mountMessages>): (boolean | undefined)[] {
  return wrapper.findAllComponents({ name: 'UserMessage' }).map((component) => (component.props() as { revertible?: boolean }).revertible);
}

describe('ChatMessage', () => {
  it('applies the shared block padding to user messages', () => {
    const messages: ChatHistoryEntry[] = [user(0, 'hi', 'm1')];
    const message = mountMessages(messages).getComponent({ name: 'UserMessage' });
    expectPadded(message, 'py-2');
    expect(message.classes()).toContain('self-end');
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

  it('offers revert only on user turns that carry an id once a second turn exists', () => {
    const wrapper = mountMessages([user(0, 'one', 'm1'), user(2, 'two', 'm2')]);
    expect(revertibleFlags(wrapper)).toEqual([true, true]);
  });

  it('withholds revert from a lone user turn', () => {
    expect(revertibleFlags(mountMessages([user(0, 'only', 'm1')]))).toEqual([false]);
  });

  it('withholds revert when the user turns have no app id', () => {
    expect(revertibleFlags(mountMessages([user(0, 'one'), user(2, 'two')]))).toEqual([false, false]);
  });
});
