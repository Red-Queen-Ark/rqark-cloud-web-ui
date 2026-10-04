import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ToolMessage from './ToolMessage.vue';

function assistantMessage(toolCall: { id: string; name: string; arguments?: string }): ChatAssistantMessage {
  return {
    role: 'assistant',
    content: '',
    created_at: '2026-01-01T00:00:00Z',
    tool_calls: [{ id: toolCall.id, type: 'function', function: { name: toolCall.name, arguments: toolCall.arguments ?? '' } }],
  };
}

function mountTool(message: ChatAssistantMessage, toolResult: Record<string, ChatToolMessage> = {}) {
  return mount(ToolMessage, { props: { message, toolResult } });
}

function result(toolCallId: string, content: string): ChatToolMessage {
  return { role: 'tool', tool_call_id: toolCallId, content, created_at: '2026-01-01T00:00:00Z' };
}

describe('ToolMessage', () => {
  it('shows a spinner while the tool result is pending', () => {
    const wrapper = mountTool(assistantMessage({ id: 'call_1', name: 'read_file' }));
    const status = wrapper.get('[data-testid="tool-status-call_1"]');
    expect(status.find('.loading').exists()).toBe(true);
    expect(status.find('svg').exists()).toBe(false);
  });

  it('shows a check when the tool succeeded', () => {
    const wrapper = mountTool(assistantMessage({ id: 'call_1', name: 'read_file' }), { call_1: result('call_1', 'ok') });
    const status = wrapper.get('[data-testid="tool-status-call_1"]');
    expect(status.find('.loading').exists()).toBe(false);
    expect(status.get('svg').classes()).toContain('text-success');
    expect(wrapper.text()).toContain('ok');
  });

  it('shows an error icon when the tool result is an error', () => {
    const wrapper = mountTool(assistantMessage({ id: 'call_1', name: 'read_file' }), {
      call_1: result('call_1', 'Error: boom'),
    });
    const status = wrapper.get('[data-testid="tool-status-call_1"]');
    expect(status.find('.loading').exists()).toBe(false);
    expect(status.get('svg').classes()).toContain('text-error');
  });

  it('shows the display_key argument next to the tool name', () => {
    const wrapper = mountTool(assistantMessage({ id: 'call_1', name: 'read_file', arguments: '{"path":"src/app.ts"}' }));
    expect(wrapper.get('[data-testid="tool-detail-call_1"]').text()).toBe('src/app.ts');
  });

  it('formats grep arguments as "pattern" in path', () => {
    const wrapper = mountTool(assistantMessage({ id: 'call_1', name: 'grep', arguments: '{"pattern":"TODO","path":"./src"}' }));
    expect(wrapper.get('[data-testid="tool-detail-call_1"]').text()).toBe('"TODO" in ./src');
  });

  it('omits the detail for a tool without a display key', () => {
    const wrapper = mountTool(assistantMessage({ id: 'call_1', name: 'unknown_tool', arguments: '{"foo":"bar"}' }));
    expect(wrapper.find('[data-testid="tool-detail-call_1"]').exists()).toBe(false);
  });

  it('omits the detail while the arguments JSON is incomplete', () => {
    const wrapper = mountTool(assistantMessage({ id: 'call_1', name: 'read_file', arguments: '{"path":"src/a' }));
    expect(wrapper.find('[data-testid="tool-detail-call_1"]').exists()).toBe(false);
  });
});
