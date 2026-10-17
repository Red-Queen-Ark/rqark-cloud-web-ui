<template>
  <div data-testid="workspace-toolbar" class="flex flex-wrap items-center gap-2">
    <div class="join">
      <button data-testid="workspace-up" class="btn btn-sm join-item" :disabled="path === '' || busy" :title="t('workspace.up')" @click="emit('up')">
        <ArrowUpIcon class="h-4 w-4" />
      </button>
      <button data-testid="workspace-refresh" class="btn btn-sm join-item" :disabled="busy" :title="t('workspace.refresh')" @click="emit('refresh')">
        <RefreshIcon class="h-4 w-4" :class="{ 'animate-spin': busy }" />
      </button>
    </div>

    <div class="join">
      <button data-testid="workspace-upload" class="btn btn-sm join-item" :title="t('workspace.upload')" @click="fileInput?.click()">
        <UploadIcon class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('workspace.upload') }}</span>
      </button>
      <button data-testid="workspace-new-file" class="btn btn-sm join-item" :title="t('workspace.newFile')" @click="emit('newFile')">
        <PlusIcon class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('workspace.newFile') }}</span>
      </button>
      <button data-testid="workspace-new-folder" class="btn btn-sm join-item" :title="t('workspace.newFolder')" @click="emit('newFolder')">
        <FolderIcon class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('workspace.newFolder') }}</span>
      </button>
    </div>

    <label class="input input-sm flex min-w-32 flex-1 items-center gap-2">
      <SearchIcon class="h-4 w-4 opacity-50" />
      <input data-testid="workspace-search" type="search" class="grow" :placeholder="t('workspace.search')" :value="query" @input="emit('search', ($event.target as HTMLInputElement).value)" />
    </label>

    <button data-testid="workspace-toggle-hidden" class="btn btn-sm" :class="{ 'btn-active': showHidden }" :title="showHidden ? t('workspace.hideHidden') : t('workspace.showHidden')" :aria-pressed="showHidden" @click="emit('toggleHidden')">
      {{ showHidden ? t('workspace.hideHidden') : t('workspace.showHidden') }}
    </button>

    <button data-testid="workspace-toggle-view" class="btn btn-sm btn-square" :title="viewMode === 'list' ? t('workspace.gridView') : t('workspace.listView')" @click="emit('toggleView')">
      <GridIcon v-if="viewMode === 'list'" class="h-4 w-4" />
      <ListIcon v-else class="h-4 w-4" />
    </button>

    <input ref="fileInput" data-testid="workspace-upload-input" type="file" multiple class="hidden" @change="pickFiles" />

    <div v-if="selectedCount > 0" data-testid="workspace-selection-bar" class="bg-base-200 flex w-full items-center gap-2 rounded-box px-3 py-1.5 text-sm sm:w-auto">
      <span class="font-medium">{{ t('workspace.selected', { count: selectedCount }) }}</span>
      <button data-testid="workspace-selection-download" class="btn btn-ghost btn-xs" @click="emit('downloadSelected')">
        <DownloadIcon class="h-3.5 w-3.5" />
        {{ t('workspace.download') }}
      </button>
      <button data-testid="workspace-selection-delete" class="btn btn-ghost btn-xs text-error" @click="emit('deleteSelected')">
        <TrashIcon class="h-3.5 w-3.5" />
        {{ t('workspace.delete') }}
      </button>
      <button data-testid="workspace-selection-clear" class="btn btn-ghost btn-xs" @click="emit('clearSelection')">
        {{ t('workspace.cancel') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import ArrowUpIcon from '@/components/svg/ArrowUpIcon.vue';
import DownloadIcon from '@/components/svg/DownloadIcon.vue';
import FolderIcon from '@/components/svg/FolderIcon.vue';
import GridIcon from '@/components/svg/GridIcon.vue';
import ListIcon from '@/components/svg/ListIcon.vue';
import PlusIcon from '@/components/svg/PlusIcon.vue';
import RefreshIcon from '@/components/svg/RefreshIcon.vue';
import SearchIcon from '@/components/svg/SearchIcon.vue';
import TrashIcon from '@/components/svg/TrashIcon.vue';
import UploadIcon from '@/components/svg/UploadIcon.vue';
import type { WorkspaceViewMode } from '@/stores/workspaceStore';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  path: string;
  query: string;
  showHidden: boolean;
  viewMode: WorkspaceViewMode;
  selectedCount: number;
  busy: boolean;
}>();

const emit = defineEmits<{
  up: [];
  refresh: [];
  upload: [files: File[]];
  newFile: [];
  newFolder: [];
  search: [query: string];
  toggleHidden: [];
  toggleView: [];
  downloadSelected: [];
  deleteSelected: [];
  clearSelection: [];
}>();

const { t } = useI18n();
const fileInput = ref<HTMLInputElement | null>(null);

function pickFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length > 0) {
    emit('upload', files);
  }
  input.value = '';
}
</script>
