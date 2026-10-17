<template>
  <div data-testid="workspace-dropzone" class="relative min-h-40" @dragenter.prevent="onDragEnter" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
    <slot></slot>
    <div v-if="dragging" data-testid="workspace-drop-overlay" class="bg-base-100/80 border-primary pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed">
      <UploadIcon class="text-primary h-10 w-10" />
      <p class="font-medium">{{ t('workspace.dropHint', { path: target || t('workspace.root') }) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import UploadIcon from '@/components/svg/UploadIcon.vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{ target: string }>();

const emit = defineEmits<{ files: [files: File[]] }>();

const { t } = useI18n();
const dragging = ref(false);
let depth = 0;

function onDragEnter() {
  depth += 1;
  dragging.value = true;
}

function onDragOver(event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
}

function onDragLeave() {
  depth = Math.max(0, depth - 1);
  if (depth === 0) {
    dragging.value = false;
  }
}

function onDrop(event: DragEvent) {
  depth = 0;
  dragging.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length > 0) {
    emit('files', files);
  }
}
</script>
