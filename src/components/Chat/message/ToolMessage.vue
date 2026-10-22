<template>
  <div v-if="props.message.tool_calls" class="w-full space-y-1">
    <details v-for="tool_call in props.message.tool_calls" :key="tool_call.id" class="collapse collapse-arrow bg-base-200/40 border-base-300/60 rounded-box border" :data-testid="`tool-call-${tool_call.id}`">
      <!--
        A native disclosure rather than a hand-rolled toggle: the row is a
        summary, so it is reachable by keyboard and its body stays in the DOM
        while closed, which keeps `find`-style assertions and browser search
        working over a collapsed turn.
      -->
      <summary class="collapse-title flex min-h-0 items-center gap-2 py-1 ps-2 pe-9 text-xs select-none hover:bg-base-200/70">
        <span class="inline-flex shrink-0 items-center" :data-testid="`tool-status-${tool_call.id}`">
          <span v-if="state(tool_call) === 'running'" class="loading loading-spinner loading-xs text-warning"></span>
          <AlertIcon v-else-if="state(tool_call) === 'error'" level="error" class="h-3.5 w-3.5 text-error" />
          <CheckIcon v-else class="h-3.5 w-3.5 text-success" />
        </span>

        <span class="shrink-0 font-mono font-medium" :class="state(tool_call) === 'error' ? 'text-error' : 'text-base-content/80'">{{ tool_call.function.name }}</span>

        <span v-if="summary(tool_call).detail" class="min-w-0 truncate font-mono text-base-content/50" :data-testid="`tool-detail-${tool_call.id}`">{{ summary(tool_call).detail }}</span>

        <span v-if="summary(tool_call).meta" class="badge badge-ghost badge-xs shrink-0 font-mono" :data-testid="`tool-meta-${tool_call.id}`">{{ summary(tool_call).meta }}</span>
      </summary>

      <div class="collapse-content border-base-300/60 border-t px-2 py-2">
        <!-- A diff is the point of an edit call, so it is preferred over the verdict the tool returns. -->
        <template v-if="diffFor(tool_call)">
          <pre
            class="scrollbar-thin max-h-72 overflow-auto font-mono text-xs leading-relaxed"
            :data-testid="`tool-diff-${tool_call.id}`"
          ><template v-for="(line, index) in shownDiff(tool_call)" :key="index"><span :class="DIFF_CLASS[line.kind]">{{ diffGutter(line.kind) }}{{ line.text }}</span>
</template></pre>
          <button v-if="foldedDiff(tool_call)" class="btn btn-ghost btn-xs mt-1" :data-testid="`tool-diff-more-${tool_call.id}`" @click.prevent="showAll(tool_call.id)">
            {{ t('chat.showAllLines', { count: hiddenDiff(tool_call) }) }}
          </button>
        </template>

        <template v-else-if="resultFor(tool_call)">
          <pre class="scrollbar-thin max-h-72 overflow-auto font-mono text-xs break-words whitespace-pre-wrap" :class="state(tool_call) === 'error' ? 'text-error' : 'text-base-content/60'" :data-testid="`tool-result-${tool_call.id}`">{{
            body(tool_call)
          }}</pre>
          <button v-if="clipped(tool_call)" class="btn btn-ghost btn-xs mt-1" :data-testid="`tool-result-more-${tool_call.id}`" @click.prevent="showAll(tool_call.id)">
            {{ t('chat.showAllLines', { count: hiddenLines(tool_call) }) }}
          </button>
        </template>

        <p v-else class="text-base-content/50 text-xs">{{ t('chat.toolRunning') }}</p>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import AlertIcon from '@/components/svg/AlertIcon.vue';
import CheckIcon from '@/components/svg/CheckIcon.vue';
import { buildToolDiff, clipResult, resultBody, summariseTool, toolState, type DiffLine, type ToolState } from '@/utils/toolDisplay';
import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';

const DIFF_CLASS: Record<DiffLine['kind'], string> = {
  add: 'block bg-success/10 text-success',
  del: 'block bg-error/10 text-error',
  ctx: 'block text-base-content/50',
  meta: 'block text-info/80',
};

/** Rows of a diff kept before and after the fold, and the length past which folding starts. */
const DIFF_HEAD = 25;
const DIFF_TAIL = 5;
const DIFF_FOLD_LINES = 40;

const DIFF_GUTTER: Record<DiffLine['kind'], string> = {
  add: '+',
  del: '-',
  ctx: ' ',
  meta: '',
};

const props = defineProps<{
  message: ChatAssistantMessage;
  toolResult: Record<string, ChatToolMessage>;
}>();

const { t } = useI18n();
const expanded = reactive(new Set<string>());

function resultFor(call: ChatToolCall): ChatToolMessage | undefined {
  return props.toolResult[call.id];
}

function state(call: ChatToolCall): ToolState {
  return toolState(resultFor(call));
}

function summary(call: ChatToolCall) {
  return summariseTool(call, resultFor(call));
}

/**
 * The diff of a call, remembered against the arguments it was built from.
 *
 * The row renders on every streaming frame and a diff costs a quadratic table,
 * so building it once per set of arguments is the difference between a fold that
 * is free and one that competes with the answer being typed.
 */
const diffCache = new Map<string, { arguments: string; diff: DiffLine[] | null }>();

function diffFor(call: ChatToolCall): DiffLine[] | null {
  const cached = diffCache.get(call.id);
  if (cached?.arguments === call.function.arguments) {
    return cached.diff;
  }
  const diff = buildToolDiff(call);
  diffCache.set(call.id, { arguments: call.function.arguments, diff });
  return diff;
}

/** A diff is folded to its first and last rows rather than to head/tail of the whole file. */
function foldedDiff(call: ChatToolCall): boolean {
  const diff = diffFor(call);
  return diff !== null && diff.length > DIFF_FOLD_LINES && !expanded.has(call.id);
}

function hiddenDiff(call: ChatToolCall): number {
  const diff = diffFor(call);
  return diff ? Math.max(diff.length - (DIFF_HEAD + DIFF_TAIL), 0) : 0;
}

function shownDiff(call: ChatToolCall): DiffLine[] {
  const diff = diffFor(call);
  if (!diff) {
    return [];
  }
  if (!foldedDiff(call)) {
    return diff;
  }
  return [...diff.slice(0, DIFF_HEAD), { kind: 'meta' as const, text: `… ${diff.length - DIFF_HEAD - DIFF_TAIL} lines` }, ...diff.slice(-DIFF_TAIL)];
}

function clipped(call: ChatToolCall): boolean {
  if (expanded.has(call.id)) {
    return false;
  }
  const result = resultFor(call);
  return result ? clipResult(resultBody(result)).hidden > 0 : false;
}

function hiddenLines(call: ChatToolCall): number {
  const result = resultFor(call);
  return result ? clipResult(resultBody(result)).hidden : 0;
}

function body(call: ChatToolCall): string {
  const result = resultFor(call);
  if (!result) {
    return '';
  }
  const text = resultBody(result);
  if (expanded.has(call.id)) {
    return text;
  }
  const parts = clipResult(text);
  if (parts.hidden === 0) {
    return text;
  }
  return [...parts.head, `… ${parts.hidden} lines hidden`, ...parts.tail].join('\n');
}

function showAll(id: string) {
  expanded.add(id);
}

function diffGutter(kind: DiffLine['kind']): string {
  const gutter = DIFF_GUTTER[kind];
  return gutter ? `${gutter} ` : '';
}
</script>
