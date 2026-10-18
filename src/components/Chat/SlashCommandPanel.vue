<template>
  <div v-if="entries.length > 0" data-testid="slash-panel" class="bg-base-200 border-base-300 rounded-box absolute inset-x-3 bottom-full z-20 mb-1 max-h-56 overflow-y-auto border shadow-lg scrollbar-thin" role="listbox" :aria-label="label">
    <button
      v-for="(entry, index) in entries"
      :key="entry.name"
      type="button"
      role="option"
      :data-testid="`slash-option-${entry.name.slice(1)}`"
      :aria-selected="index === activeIndex"
      class="flex w-full items-baseline gap-2 px-3 py-1.5 text-left"
      :class="index === activeIndex ? 'bg-primary/20' : ''"
      @mousedown.prevent
      @mouseenter="emit('hover', index)"
      @click="emit('select', index)"
    >
      <span class="font-mono text-xs" :class="entry.kind === 'sop' ? 'text-secondary' : 'text-primary'">{{ entry.name }}</span>
      <span class="text-base-content/60 truncate text-xs">{{ entry.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SlashEntry } from '@/config/slashCommands';

defineProps<{
  entries: SlashEntry[];
  activeIndex: number;
  /** The listbox's accessible name. */
  label: string;
}>();

const emit = defineEmits<{
  select: [index: number];
  hover: [index: number];
}>();
</script>
