import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ToolMessage from './ToolMessage.vue';

const message: ChatAssistantMessage = {
  role: 'assistant',
  content: '',
  created_at: '2026-01-01T00:00:00Z',
  tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{}' } }],
};

function mountTool(toolResult: Record<string, ChatToolMessage>) {
  return mount(ToolMessage, { props: { message, toolResult } });
}

function result(content: string): ChatToolMessage {
  return { role: 'tool', tool_call_id: 'call_1', content, created_at: '2026-01-01T00:00:00Z' };
}

describe('ToolMessage', () => {
  it('shows a spinner while the tool result is pending', () => {
    const wrapper = mountTool({});
    const status = wrapper.get('[data-testid="tool-status-call_1"]');
    expect(status.find('.loading').exists()).toBe(true);
    expect(status.find('svg').exists()).toBe(false);
  });

  it('shows a check when the tool succeeded', () => {
    const wrapper = mountTool({ call_1: result('ok') });
    const status = wrapper.get('[data-testid="tool-status-call_1"]');
    expect(status.find('.loading').exists()).toBe(false);
    expect(status.get('svg').classes()).toContain('text-success');
    expect(wrapper.text()).toContain('ok');
  });

  it('shows an error icon when the tool result is an error', () => {
    const wrapper = mountTool({ call_1: result('Error: boom') });
    const status = wrapper.get('[data-testid="tool-status-call_1"]');
    expect(status.find('.loading').exists()).toBe(false);
    expect(status.get('svg').classes()).toContain('text-error');
  });
});
