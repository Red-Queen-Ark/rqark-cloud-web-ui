import { i18n } from '@/i18n';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ToolMessage from './ToolMessage.vue';

function assistantMessage(toolCalls: { id: string; name: string; arguments?: string }[]): ChatAssistantMessage {
  return {
    role: 'assistant',
    content: '',
    created_at: '2026-01-01T00:00:00Z',
    tool_calls: toolCalls.map((call) => ({ id: call.id, type: 'function' as const, function: { name: call.name, arguments: call.arguments ?? '' } })),
  };
}

function mountTool(message: ChatAssistantMessage, toolResult: Record<string, ChatToolMessage> = {}) {
  return mount(ToolMessage, { props: { message, toolResult }, global: { plugins: [i18n] } });
}

function result(toolCallId: string, content: string): ChatToolMessage {
  return { role: 'tool', tool_call_id: toolCallId, content, created_at: '2026-01-01T00:00:00Z' };
}

describe('ToolMessage', () => {
  it('shows a spinner while the tool result is pending', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'read_file' }]));
    const status = wrapper.get('[data-testid="tool-status-call_1"]');
    expect(status.find('.loading').exists()).toBe(true);
    expect(status.find('svg').exists()).toBe(false);
  });

  it('shows a check when the tool succeeded', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'read_file' }]), { call_1: result('call_1', 'ok') });
    const status = wrapper.get('[data-testid="tool-status-call_1"]');
    expect(status.find('.loading').exists()).toBe(false);
    expect(status.get('svg').classes()).toContain('text-success');
    expect(wrapper.text()).toContain('ok');
  });

  it('shows an error icon when the tool result is an error', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'read_file' }]), {
      call_1: result('call_1', 'Error: boom'),
    });
    const status = wrapper.get('[data-testid="tool-status-call_1"]');
    expect(status.find('.loading').exists()).toBe(false);
    expect(status.get('svg').classes()).toContain('text-error');
  });

  it('shows the display_key argument next to the tool name', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'read_file', arguments: '{"path":"src/app.ts"}' }]));
    expect(wrapper.get('[data-testid="tool-detail-call_1"]').text()).toBe('src/app.ts');
  });

  it('formats grep arguments as "pattern" in path', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'grep', arguments: '{"pattern":"TODO","path":"./src"}' }]));
    expect(wrapper.get('[data-testid="tool-detail-call_1"]').text()).toBe('"TODO" in ./src');
  });

  it('omits the detail for a tool without a display key', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'unknown_tool', arguments: '{"foo":"bar"}' }]));
    expect(wrapper.find('[data-testid="tool-detail-call_1"]').exists()).toBe(false);
  });

  it('omits the detail while the arguments JSON is incomplete', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'read_file', arguments: '{"path":"src/a' }]));
    expect(wrapper.find('[data-testid="tool-detail-call_1"]').exists()).toBe(false);
  });

  it('summarises an edit as added and removed line counts', () => {
    const args = JSON.stringify({ path: 'src/a.ts', old_string: 'one\ntwo', new_string: 'one\nTWO\nthree' });
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'edit_file', arguments: args }]));
    expect(wrapper.get('[data-testid="tool-meta-call_1"]').text()).toBe('+2 −1');
  });

  it('reports the line count a read returned', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'read_file', arguments: '{"path":"src/a.ts"}' }]), {
      call_1: result('call_1', '1: one\n2: two\n3: three'),
    });
    expect(wrapper.get('[data-testid="tool-meta-call_1"]').text()).toBe('3 lines');
  });

  it('reports the exit code of a command', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'exec', arguments: '{"command":"make"}' }]), {
      call_1: result('call_1', 'exit code: 2'),
    });
    expect(wrapper.get('[data-testid="tool-meta-call_1"]').text()).toBe('exit 2');
  });

  it('renders the edit as a diff rather than as the tool verdict', () => {
    const args = JSON.stringify({ path: 'src/a.ts', old_string: 'one\ntwo', new_string: 'one\nTWO' });
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'edit_file', arguments: args }]), {
      call_1: result('call_1', 'Successfully edited src/a.ts'),
    });
    const diff = wrapper.get('[data-testid="tool-diff-call_1"]').text();
    expect(diff).toContain('@@ src/a.ts @@');
    expect(diff).toContain('- two');
    expect(diff).toContain('+ TWO');
  });

  it('draws one row per diff line, with no whitespace of its own between them', () => {
    const args = JSON.stringify({ path: 'src/a.ts', old_string: 'one\ntwo', new_string: 'one\nTWO' });
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'edit_file', arguments: args }]), {
      call_1: result('call_1', 'Successfully edited src/a.ts'),
    });
    const rows = [...wrapper.get('[data-testid="tool-diff-call_1"]').element.childNodes];
    expect(rows.filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent)).toHaveLength(0);
  });

  it('keeps the raw result for a tool that carries no before/after text', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'exec', arguments: '{"command":"make"}' }]), {
      call_1: result('call_1', 'exit code: 0\nstdout:\ndone'),
    });
    expect(wrapper.find('[data-testid="tool-diff-call_1"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="tool-result-call_1"]').text()).toContain('done');
  });

  it('folds a long result and offers the rest on demand', async () => {
    const body = Array.from({ length: 60 }, (_, index) => `line ${index}`).join('\n');
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'exec', arguments: '{"command":"make"}' }]), {
      call_1: result('call_1', body),
    });
    expect(wrapper.get('[data-testid="tool-result-call_1"]').text()).toContain('lines hidden');
    expect(wrapper.get('[data-testid="tool-result-call_1"]').text()).not.toContain('line 30');

    await wrapper.get('[data-testid="tool-result-more-call_1"]').trigger('click');

    expect(wrapper.get('[data-testid="tool-result-call_1"]').text()).toContain('line 30');
  });

  it('reads an empty result as no content rather than as a blank block', () => {
    const wrapper = mountTool(assistantMessage([{ id: 'call_1', name: 'exec', arguments: '{"command":"true"}' }]), {
      call_1: result('call_1', '   '),
    });
    expect(wrapper.get('[data-testid="tool-result-call_1"]').text()).toBe('(no content)');
  });
});
