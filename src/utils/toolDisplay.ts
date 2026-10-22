/**
 * How one tool call is read in the transcript.
 *
 * The summary is built from the call's arguments and, because a tool's return
 * value is often a verdict rather than the interesting part ("Successfully
 * edited src/a.ts"), the corpus is the arguments too: `edit_file` carries the
 * old and new text, so the diff can be rendered without asking the backend for
 * one. The result is only used for counts and for the raw body.
 */

import { formatToolDetail, parseToolArguments } from '@/utils/toolDetail';

export type ToolDetailLevel = 'summary' | 'diff' | 'full';

export type ToolState = 'running' | 'ok' | 'error';

export interface ToolSummary {
  /** What the call was aimed at: a path, a command, a pattern. */
  detail: string;
  /** What it produced, when that is short enough to be a suffix: +12 −3, 84 lines, exit 0. */
  meta: string;
}

export type DiffKind = 'add' | 'del' | 'ctx' | 'meta';

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

export const TOOL_ERROR_PREFIX = 'Error:';

/** Rows kept before the fold in a clipped result body. */
export const CLIP_HEAD = 20;
/** Rows kept after the fold in a clipped result body. */
export const CLIP_TAIL = 5;

const DIFF_CELL_LIMIT = 250_000;

const NO_CONTENT = '(no content)';

/** The lines of a text, ignoring the empty tail a trailing newline leaves behind. */
function lines(text: string): string[] {
  const split = text.split('\n');
  if (split.length > 0 && split[split.length - 1] === '') {
    split.pop();
  }
  return split;
}

/** Counts of the lines a call added and removed, by diffing the argument's two halves. */
function editCounts(args: Record<string, unknown>): { added: number; removed: number } | null {
  const before = args['old_string'];
  const after = args['new_string'];
  if (typeof before !== 'string' || typeof after !== 'string') {
    return null;
  }
  const ops = diffOps(lines(before), lines(after));
  if (!ops) {
    return null;
  }
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.kind === 'add') {
      added += 1;
    } else if (op.kind === 'del') {
      removed += 1;
    }
  }
  return { added, removed };
}

interface DiffOp {
  kind: DiffKind;
  text: string;
}

export function toolState(result: ChatToolMessage | undefined): ToolState {
  if (!result) {
    return 'running';
  }
  return result.content.startsWith(TOOL_ERROR_PREFIX) ? 'error' : 'ok';
}

/**
 * Line diff by longest common subsequence. The two strings of an edit are
 * snippets rather than files, so the quadratic table is bounded and cheap; over
 * the cell limit the answer degrades to "all of the old, then all of the new"
 * rather than freezing the tab on a pathological pair.
 */
function diffOps(before: string[], after: string[]): DiffOp[] | null {
  if (before.length === 0 && after.length === 0) {
    return [];
  }
  if (before.length * after.length > DIFF_CELL_LIMIT) {
    return [...before.map((text) => ({ kind: 'del' as const, text })), ...after.map((text) => ({ kind: 'add' as const, text }))];
  }

  const rows = before.length;
  const cols = after.length;
  // widths[i][j] is the length of the LCS of before[i:] and after[j:].
  const widths: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      widths[i][j] = before[i] === after[j] ? widths[i + 1][j + 1] + 1 : Math.max(widths[i + 1][j], widths[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      ops.push({ kind: 'ctx', text: before[i] });
      i += 1;
      j += 1;
    } else if (widths[i + 1][j] >= widths[i][j + 1]) {
      ops.push({ kind: 'del', text: before[i] });
      i += 1;
    } else {
      ops.push({ kind: 'add', text: after[j] });
      j += 1;
    }
  }
  while (i < rows) {
    ops.push({ kind: 'del', text: before[i] });
    i += 1;
  }
  while (j < cols) {
    ops.push({ kind: 'add', text: after[j] });
    j += 1;
  }
  return ops;
}

/** The diff a call performed, or null when the call carries no before/after text. */
export function buildToolDiff(call: ChatToolCall): DiffLine[] | null {
  const args = parseToolArguments(call.function.arguments);
  if (!args) {
    return null;
  }

  const path = String(args['path'] ?? '');
  if (call.function.name === 'edit_file') {
    const before = args['old_string'];
    const after = args['new_string'];
    if (typeof before !== 'string' || typeof after !== 'string') {
      return null;
    }
    const ops = diffOps(lines(before), lines(after));
    if (!ops) {
      return null;
    }
    return [{ kind: 'meta', text: `@@ ${path || 'edit_file'} @@` }, ...ops];
  }

  if (call.function.name === 'write_file') {
    const body = args['content'];
    if (typeof body !== 'string') {
      return null;
    }
    // Nothing was read before the write, so every line is an addition: calling it
    // a diff of before → after would claim a deletion that never happened.
    return [{ kind: 'meta', text: `@@ ${path || 'write_file'} (new content) @@` }, ...lines(body).map((text) => ({ kind: 'add' as const, text }))];
  }

  return null;
}

/** Result body split into the part shown, the part folded away, and the part shown after the fold. */
export interface ClippedText {
  head: string[];
  tail: string[];
  hidden: number;
}

export function clipResult(text: string, head = CLIP_HEAD, tail = CLIP_TAIL): ClippedText {
  const all = text.replace(/\n+$/, '').split('\n');
  if (all.length <= head + tail) {
    return { head: all, tail: [], hidden: 0 };
  }
  return { head: all.slice(0, head), tail: all.slice(-tail), hidden: all.length - head - tail };
}

function resultLineCount(result: ChatToolMessage | undefined): number {
  if (!result || !result.content.trim()) {
    return 0;
  }
  return lines(result.content).length;
}

function execExitCode(result: ChatToolMessage | undefined): string {
  const match = /^exit code: (-?\d+)/m.exec(result?.content ?? '');
  return match ? match[1] : '';
}

function grepHits(result: ChatToolMessage | undefined): number {
  if (!result) {
    return 0;
  }
  if (result.content.startsWith('No matches')) {
    return 0;
  }
  return lines(result.content).filter((line) => line.trim() !== '').length;
}

/**
 * The one line a tool call is given in the transcript.
 *
 * Where the call points comes from `formatToolDetail`, which reads the
 * arguments: they are complete before the tool has run, so a running call
 * already says what it is doing. What it produced is a short suffix, added once
 * there is a result.
 */
export function summariseTool(call: ChatToolCall, result: ChatToolMessage | undefined): ToolSummary {
  const args = parseToolArguments(call.function.arguments);
  if (!args) {
    return { detail: '', meta: '' };
  }
  return { detail: formatToolDetail(call.function.name, args), meta: metaFor(call.function.name, args, result) };
}

function metaFor(name: string, args: Record<string, unknown>, result: ChatToolMessage | undefined): string {
  switch (name) {
    case 'edit_file': {
      const counts = editCounts(args);
      return counts ? `+${counts.added} −${counts.removed}` : '';
    }
    case 'write_file': {
      const body = args['content'];
      const added = typeof body === 'string' ? lines(body).length : 0;
      return added > 0 ? `+${added}` : '';
    }
    case 'read_file': {
      const count = resultLineCount(result);
      return count > 0 ? `${count} lines` : '';
    }
    case 'list_dir': {
      const count = resultLineCount(result);
      return count > 0 ? `${count} entries` : '';
    }
    case 'grep': {
      const hits = grepHits(result);
      return hits > 0 ? `${hits} hits` : '';
    }
    case 'exec':
    case 'shell': {
      const exit = execExitCode(result);
      return exit ? `exit ${exit}` : '';
    }
    default:
      return '';
  }
}

/** The body to show for a result, with the "no output" placeholder the shell tools use kept literal. */
export function resultBody(result: ChatToolMessage): string {
  const text = result.content;
  if (!text.trim()) {
    return NO_CONTENT;
  }
  if (/^exit code: 0\n\(no output\)$/.test(text.trim())) {
    return '(no output)';
  }
  return text;
}
