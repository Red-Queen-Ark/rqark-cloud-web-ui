import { i18n } from '@/i18n';
import { useAlertStore } from '@/stores/alertStore';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TurnGroup from './TurnGroup.vue';

const START = '2026-01-01T00:00:00Z';
const END = '2026-01-01T00:00:08Z';

function assistant(seq: number, data: Partial<ChatAssistantMessage> = {}): ChatHistoryEntry {
  return { seq, role: 'assistant', data: { role: 'assistant', content: '', created_at: END, ...data }, created_at: END };
}

function tool(seq: number, id: string, content: string): ChatHistoryEntry {
  return { seq, role: 'tool', data: { role: 'tool', tool_call_id: id, content, created_at: END }, created_at: END };
}

function mountTurn(entries: ChatHistoryEntry[], startedAt = START, streaming = false) {
  return mount(TurnGroup, { props: { entries, toolResult: {}, startedAt, streaming }, global: { plugins: [i18n] } });
}

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TurnGroup', () => {
  it('reports how long the turn took', () => {
    const wrapper = mountTurn([assistant(1, { content: 'done', reasoning_content: 'because' })]);
    expect(wrapper.get('[data-testid="turn-duration"]').text()).toBe('Worked for 8.0s');
  });

  it('gives no duration for a plain answer, which has nothing to fold', () => {
    expect(
      mountTurn([assistant(1, { content: 'done' })])
        .find('[data-testid="turn-duration"]')
        .exists(),
    ).toBe(false);
  });

  it('leaves the duration out when the turn has no start', () => {
    const wrapper = mountTurn([assistant(1, { content: 'done' })], '');
    expect(wrapper.find('[data-testid="turn-duration"]').exists()).toBe(false);
  });

  it('counts every tool call in the turn, across entries', () => {
    const entries = [
      assistant(1, { tool_calls: [{ id: 'a', type: 'function', function: { name: 'read_file', arguments: '{}' } }] }),
      tool(2, 'a', 'ok'),
      assistant(3, { tool_calls: [{ id: 'b', type: 'function', function: { name: 'exec', arguments: '{}' } }] }),
      tool(4, 'b', 'ok'),
      assistant(5, { content: 'answer' }),
    ];
    expect(mountTurn(entries).get('[data-testid="turn-tool-count"]').text()).toBe('2 tools');
  });

  it('uses the singular for one tool', () => {
    const entries = [assistant(1, { tool_calls: [{ id: 'a', type: 'function', function: { name: 'read_file', arguments: '{}' } }] })];
    expect(mountTurn(entries).get('[data-testid="turn-tool-count"]').text()).toBe('1 tool');
  });

  it('folds the activity away when the turn is done', () => {
    const entries = [assistant(1, { content: 'answer', reasoning_content: 'thinking' })];
    expect(mountTurn(entries).get('details').attributes('open')).toBeUndefined();
  });

  it('opens the activity while the turn is streaming', () => {
    const entries = [assistant(1, { reasoning_content: 'thinking' })];
    expect(mountTurn(entries, START, true).get('details').attributes('open')).toBeDefined();
  });

  it('draws no activity block for a plain answer', () => {
    expect(
      mountTurn([assistant(1, { content: 'answer' })])
        .find('details')
        .exists(),
    ).toBe(false);
  });

  it('folds reasoning into its own block rather than dropping it', () => {
    const entries = [assistant(1, { content: 'answer', reasoning_content: 'thinking' })];
    const think = mountTurn(entries).get('[data-testid="think-block"]');
    expect(think.element.tagName).toBe('DETAILS');
    expect(think.attributes('open')).toBeUndefined();
    expect(think.text()).toContain('thinking');
  });

  it('keeps the reasoning and the tool calls in the order they arrived', () => {
    // What actually happens: think, call a tool, think again about the result.
    // Hoisting both reasoning blocks to the top would claim it thought once,
    // before it had seen anything.
    const entries = [
      assistant(1, { reasoning_content: 'first thought', tool_calls: [{ id: 'a', type: 'function', function: { name: 'read_file', arguments: '{}' } }] }),
      tool(2, 'a', 'ok'),
      assistant(3, { reasoning_content: 'second thought', tool_calls: [{ id: 'b', type: 'function', function: { name: 'exec', arguments: '{}' } }] }),
      tool(4, 'b', 'ok'),
    ];
    const text = mountTurn(entries).get('details').text();
    expect(text.indexOf('first thought')).toBeLessThan(text.indexOf('read_file'));
    expect(text.indexOf('read_file')).toBeLessThan(text.indexOf('second thought'));
    expect(text.indexOf('second thought')).toBeLessThan(text.indexOf('exec'));
  });

  it('joins the answers of the turn in order', () => {
    const entries = [assistant(1, { content: 'first' }), assistant(2, { content: 'second' })];
    expect(mountTurn(entries).text()).toContain('first');
    expect(mountTurn(entries).text()).toContain('second');
  });

  it('copies the joined answer', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const wrapper = mountTurn([assistant(1, { content: 'first' }), assistant(2, { content: 'second' })]);

    await wrapper.get('[data-testid="assistant-message-copy"]').trigger('click');

    expect(writeText).toHaveBeenCalledWith('first\n\nsecond');
    expect(useAlertStore().alertList.map((item) => item.level)).toEqual(['success']);
  });

  it('shows the time of the last message of the turn', () => {
    expect(
      mountTurn([assistant(1, { content: 'answer' })])
        .get('[data-testid="assistant-message-time"]')
        .text(),
    ).not.toBe('');
  });
});
