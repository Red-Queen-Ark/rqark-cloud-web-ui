<template>
  <div v-if="entries.length > 0" data-testid="file-panel" class="bg-base-200 border-base-300 rounded-box absolute inset-x-3 bottom-full z-20 mb-1 max-h-56 overflow-y-auto border shadow-lg scrollbar-thin" role="listbox" :aria-label="label">
    <button
      v-for="(entry, index) in entries"
      :key="entry.path"
      type="button"
      role="option"
      :data-testid="`file-option-${entry.path}`"
      :aria-selected="index === activeIndex"
      class="flex w-full items-baseline gap-2 px-3 py-1.5 text-left"
      :class="index === activeIndex ? 'bg-primary/20' : ''"
      @mousedown.prevent
      @mouseenter="emit('hover', index)"
      @click="emit('select', index)"
    >
      <span class="font-mono text-xs truncate" :class="entry.type === 'dir' ? 'text-secondary' : 'text-primary'">{{ display(entry) }}</span>
      <span class="text-base-content/60 truncate text-xs">{{ parent(entry) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { WorkspaceEntry } from '@/config/workspace';

defineProps<{
  entries: WorkspaceEntry[];
  activeIndex: number;
  /** The listbox's accessible name. */
  label: string;
}>();

const emit = defineEmits<{
  select: [index: number];
  hover: [index: number];
}>();

/** The last segment, with a trailing slash so a directory reads as one. */
function display(entry: WorkspaceEntry): string {
  return entry.type === 'dir' ? `${entry.name}/` : entry.name;
}

/** The directory above the entry, shown greyed out to tell same-named files apart. */
function parent(entry: WorkspaceEntry): string {
  const index = entry.path.lastIndexOf('/');
  return index < 0 ? '' : entry.path.slice(0, index + 1);
}
</script>
