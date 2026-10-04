import { describe, expect, it } from 'vitest';
import { formatToolDetail, getDisplayKey, parseToolArguments, toolDetailFromCall } from './toolDetail';

describe('getDisplayKey', () => {
  it('maps known tools to their display key', () => {
    expect(getDisplayKey('read_file')).toBe('path');
    expect(getDisplayKey('grep')).toBe('pattern');
  });

  it('returns an empty key for unknown tools', () => {
    expect(getDisplayKey('mystery')).toBe('');
  });
});

describe('parseToolArguments', () => {
  it('parses a JSON object', () => {
    expect(parseToolArguments('{"path":"a.ts"}')).toEqual({ path: 'a.ts' });
  });

  it('returns null for invalid or non-object JSON', () => {
    expect(parseToolArguments('')).toBeNull();
    expect(parseToolArguments('{oops')).toBeNull();
    expect(parseToolArguments('["a"]')).toBeNull();
  });
});

describe('formatToolDetail', () => {
  it('returns the display value for a simple tool', () => {
    expect(formatToolDetail('read_file', { path: 'src/app.ts' })).toBe('src/app.ts');
  });

  it('formats grep with and without a path', () => {
    expect(formatToolDetail('grep', { pattern: 'TODO', path: './src' })).toBe('"TODO" in ./src');
    expect(formatToolDetail('grep', { pattern: 'TODO', path: '.' })).toBe('"TODO"');
  });

  it('truncates long values to 80 characters', () => {
    const detail = formatToolDetail('web_search', { query: 'x'.repeat(100) });
    expect(detail).toHaveLength(81);
    expect(detail.endsWith('…')).toBe(true);
  });

  it('keeps the full command for exec', () => {
    const command = 'x'.repeat(100);
    expect(formatToolDetail('exec', { command })).toBe(command);
  });

  it('renders plan_update items with status emoji', () => {
    const items = [{ status: 'completed', content: 'ship it' }];
    expect(formatToolDetail('plan_update', { items })).toBe('✅ ship it');
  });

  it('reads an emptied plan as cleared rather than as nothing to say', () => {
    // An empty list stringifies to '', which a value-empty guard would swallow.
    expect(formatToolDetail('plan_update', { items: [] })).toBe('cleared');
  });

  it('returns an empty string when the display value is missing', () => {
    expect(formatToolDetail('read_file', {})).toBe('');
    expect(formatToolDetail('mystery', { anything: 1 })).toBe('');
  });
});

describe('toolDetailFromCall', () => {
  it('reads the arguments JSON from a tool call', () => {
    const call: ChatToolCall = { id: 'c1', type: 'function', function: { name: 'web_fetch', arguments: '{"url":"https://x.dev"}' } };
    expect(toolDetailFromCall(call)).toBe('https://x.dev');
  });

  it('returns an empty string for unparseable arguments', () => {
    const call: ChatToolCall = { id: 'c1', type: 'function', function: { name: 'web_fetch', arguments: '{"url":"https://x' } };
    expect(toolDetailFromCall(call)).toBe('');
  });
});
