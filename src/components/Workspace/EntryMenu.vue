<template>
  <div class="dropdown dropdown-end">
    <button type="button" tabindex="0" data-testid="workspace-entry-menu-button" class="btn btn-ghost btn-xs btn-square border-transparent" :aria-label="t('workspace.more')" :title="t('workspace.more')" @click.stop>
      <EllipsisVerticalIcon class="h-4 w-4" />
    </button>
    <ul tabindex="0" data-testid="workspace-entry-menu" class="dropdown-content menu bg-base-200 rounded-box z-50 w-44 p-1 shadow-md">
      <li>
        <button data-testid="workspace-entry-download" @click="choose('download')">
          <DownloadIcon class="h-3.5 w-3.5" />
          {{ entry.type === 'dir' ? t('workspace.downloadZip') : t('workspace.download') }}
        </button>
      </li>
      <li>
        <button data-testid="workspace-entry-rename" @click="choose('rename')">
          <PencilIcon class="h-3.5 w-3.5" />
          {{ t('workspace.rename') }}
        </button>
      </li>
      <li>
        <button data-testid="workspace-entry-copy" @click="choose('copy')">
          <CopyIcon class="h-3.5 w-3.5" />
          {{ t('workspace.copyPath') }}
        </button>
      </li>
      <li>
        <button data-testid="workspace-entry-delete" class="text-error" @click="choose('delete')">
          <TrashIcon class="h-3.5 w-3.5" />
          {{ t('workspace.delete') }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import CopyIcon from '@/components/svg/CopyIcon.vue';
import DownloadIcon from '@/components/svg/DownloadIcon.vue';
import EllipsisVerticalIcon from '@/components/svg/EllipsisVerticalIcon.vue';
import PencilIcon from '@/components/svg/PencilIcon.vue';
import TrashIcon from '@/components/svg/TrashIcon.vue';
import type { WorkspaceEntry } from '@/config/workspace';
import { useI18n } from 'vue-i18n';

defineProps<{ entry: WorkspaceEntry }>();

const emit = defineEmits<{
  download: [];
  rename: [];
  delete: [];
  copy: [];
}>();

const { t } = useI18n();

function choose(action: 'download' | 'rename' | 'copy' | 'delete') {
  (document.activeElement as HTMLElement | null)?.blur();
  switch (action) {
    case 'download':
      emit('download');
      return;
    case 'rename':
      emit('rename');
      return;
    case 'copy':
      emit('copy');
      return;
    case 'delete':
      emit('delete');
  }
}
</script>
