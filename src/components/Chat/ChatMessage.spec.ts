import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ChatMessage from './ChatMessage.vue';

const created_at = '2026-01-01T00:00:00Z';

function mountMessages(messages: ChatHistoryEntry[]) {
  return mount(ChatMessage, { props: { messages } });
}

function expectPadded(component: { classes: () => string[] }) {
  expect(component.classes()).toContain('px-4');
  expect(component.classes()).toContain('py-1');
}

describe('ChatMessage', () => {
  it('applies the shared block padding to user messages', () => {
    const messages: ChatHistoryEntry[] = [{ seq: 1, role: 'user', data: { role: 'user', content: [{ type: 'text', text: 'hi' }], created_at }, created_at }];
    const user = mountMessages(messages).getComponent({ name: 'UserMessage' });
    expectPadded(user);
    expect(user.classes()).toContain('self-end');
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
});
