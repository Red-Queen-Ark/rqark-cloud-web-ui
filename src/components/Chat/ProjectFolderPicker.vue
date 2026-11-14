<template>
  <div data-testid="project-folder-picker" class="rounded-box border-base-300 flex flex-col border">
    <div class="border-base-300 flex items-center gap-1 border-b px-2 py-1.5 text-xs">
      <button type="button" class="btn btn-ghost btn-xs btn-square" :disabled="!path" :title="t('projects.up')" data-testid="project-folder-up" @click="navigate(parentOf(path))">
        <ArrowUpIcon class="h-3.5 w-3.5" />
      </button>
      <FolderIcon class="text-primary h-3.5 w-3.5 shrink-0" />
      <span class="min-w-0 truncate font-mono">{{ projectPathLabel(path) }}</span>
    </div>

    <ul class="menu menu-sm max-h-48 w-full flex-nowrap overflow-y-auto scrollbar-thin p-1" data-testid="project-folder-entries">
      <li v-if="loading">
        <span class="text-base-content/60 flex items-center gap-2"><span class="loading loading-spinner loading-xs"></span>{{ t('projects.loading') }}</span>
      </li>
      <li v-else-if="error">
        <span class="text-error text-xs">{{ t('projects.listError') }}</span>
      </li>
      <li v-else-if="folders.length === 0">
        <span class="text-base-content/60 text-xs">{{ t('projects.emptyFolder') }}</span>
      </li>
      <li v-for="folder in folders" :key="folder.path">
        <button type="button" class="flex min-w-0 items-center gap-1.5 text-left" :data-testid="`project-folder-${folder.path}`" @click="navigate(folder.path)">
          <FolderIcon class="text-primary h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ folder.name }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { listWorkspace } from '@/api-client/workspace';
import ArrowUpIcon from '@/components/svg/ArrowUpIcon.vue';
import FolderIcon from '@/components/svg/FolderIcon.vue';
import { projectPathLabel } from '@/config/projects';
import type { WorkspaceEntry } from '@/config/workspace';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  /** The folder being offered as the project: relative to the volume root, '' for the root itself. */
  modelValue: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [path: string] }>();

const { t } = useI18n();

const loading = ref(false);
const error = ref(false);
const entries = ref<WorkspaceEntry[]>([]);

const path = computed(() => props.modelValue);
const folders = computed(() => entries.value.filter((entry) => entry.type === 'dir'));

function parentOf(current: string): string {
  const parts = current.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function navigate(next: string) {
  emit('update:modelValue', next);
}

async function load() {
  loading.value = true;
  error.value = false;
  try {
    const listing = await listWorkspace(path.value);
    entries.value = listing.entries;
  } catch {
    entries.value = [];
    error.value = true;
  } finally {
    loading.value = false;
  }
}

// The dialog opens on the folder the caller suggests, and every move in or out
// of a folder is a new listing. Keyed on the value rather than on a click, so a
// path typed by hand browses just as well.
watch(path, load, { immediate: true });
</script>
