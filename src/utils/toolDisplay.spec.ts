import { describe, expect, it } from 'vitest';
import { buildToolDiff, clipResult, resultBody, summariseTool, toolState } from './toolDisplay';

function call(name: string, args: Record<string, unknown>): ChatToolCall {
  return { id: 'c1', type: 'function', function: { name, arguments: JSON.stringify(args) } };
}

function result(content: string): ChatToolMessage {
  return { role: 'tool', tool_call_id: 'c1', content, created_at: '2026-01-01T00:00:00Z' };
}

describe('toolState', () => {
  it('is running until a result arrives', () => {
    expect(toolState(undefined)).toBe('running');
  });

  it('reads the error prefix as a failure', () => {
    expect(toolState(result('Error: nope'))).toBe('error');
    expect(toolState(result('ok'))).toBe('ok');
  });
});

describe('summariseTool', () => {
  it('counts the lines an edit added and removed', () => {
    const summary = summariseTool(call('edit_file', { path: 'a.ts', old_string: 'one\ntwo\nthree', new_string: 'one\nTWO\nthree' }), result('Successfully edited a.ts'));
    expect(summary).toEqual({ detail: 'a.ts', meta: '+1 −1' });
  });

  it('adds no counts for an edit whose arguments are unreadable', () => {
    const summary = summariseTool({ id: 'c1', type: 'function', function: { name: 'edit_file', arguments: '{oops' } }, undefined);
    expect(summary).toEqual({ detail: '', meta: '' });
  });

  it('counts a write as pure addition', () => {
    expect(summariseTool(call('write_file', { path: 'a.ts', content: 'one\ntwo' }), result('Successfully wrote a.ts')).meta).toBe('+2');
  });

  it('counts the lines a read returned', () => {
    expect(summariseTool(call('read_file', { path: 'a.ts' }), result('1: a\n2: b')).meta).toBe('2 lines');
  });

  it('counts grep hits but not the truncation notice', () => {
    expect(summariseTool(call('grep', { pattern: 'TODO' }), result('a.ts:1:TODO\nb.ts:2:TODO')).meta).toBe('2 hits');
    expect(summariseTool(call('grep', { pattern: 'TODO' }), result('No matches for: TODO')).meta).toBe('');
  });

  it('reports the exit code of a command', () => {
    expect(summariseTool(call('exec', { command: 'make' }), result('exit code: 0\nstdout:\ndone')).meta).toBe('exit 0');
  });

  it('says nothing about the outcome before there is one', () => {
    expect(summariseTool(call('exec', { command: 'make' }), undefined)).toEqual({ detail: 'make', meta: '' });
  });
});

describe('buildToolDiff', () => {
  it('diffs the two halves of an edit', () => {
    const diff = buildToolDiff(call('edit_file', { path: 'a.ts', old_string: 'one\ntwo', new_string: 'one\nTWO' }));
    expect(diff?.map((line) => `${line.kind}:${line.text}`)).toEqual(['meta:@@ a.ts @@', 'ctx:one', 'del:two', 'add:TWO']);
  });

  it('reads a write as all additions', () => {
    const diff = buildToolDiff(call('write_file', { path: 'a.ts', content: 'one\ntwo' }));
    expect(diff).toEqual([
      { kind: 'meta', text: '@@ a.ts (new content) @@' },
      { kind: 'add', text: 'one' },
      { kind: 'add', text: 'two' },
    ]);
  });

  it('has nothing to diff for a tool that carries no text', () => {
    expect(buildToolDiff(call('exec', { command: 'make' }))).toBeNull();
  });

  it('has nothing to diff when the arguments are unreadable', () => {
    expect(buildToolDiff({ id: 'c1', type: 'function', function: { name: 'edit_file', arguments: '' } })).toBeNull();
  });
});

describe('clipResult', () => {
  it('keeps a short body whole', () => {
    expect(clipResult('one\ntwo')).toEqual({ head: ['one', 'two'], tail: [], hidden: 0 });
  });

  it('folds a long body into a head and a tail', () => {
    const body = Array.from({ length: 40 }, (_, index) => `line ${index}`).join('\n');
    const clipped = clipResult(body, 20, 5);
    expect(clipped.head).toHaveLength(20);
    expect(clipped.tail).toHaveLength(5);
    expect(clipped.hidden).toBe(15);
  });

  it('does not count the empty line a trailing newline leaves', () => {
    expect(clipResult('one\ntwo\n').hidden).toBe(0);
  });
});

describe('resultBody', () => {
  it('reads an empty result as no content', () => {
    expect(resultBody(result('   '))).toBe('(no content)');
  });

  it('keeps the shell tools own no-output placeholder', () => {
    expect(resultBody(result('exit code: 0\n(no output)'))).toBe('(no output)');
  });
});
