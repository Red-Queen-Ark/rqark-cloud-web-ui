<template>
  <div data-testid="workspace-list" :data-view="viewMode" class="min-h-0">
    <div v-if="loading && entries.length === 0" data-testid="workspace-skeleton" class="space-y-2 py-2">
      <div v-for="row in 6" :key="row" class="skeleton h-9 w-full"></div>
    </div>

    <div v-else-if="entries.length === 0" data-testid="workspace-empty" class="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <FolderIcon class="h-12 w-12 opacity-30" />
      <p class="font-medium">{{ t('workspace.empty') }}</p>
      <p class="text-base-content/60 text-sm">{{ t('workspace.emptyHint') }}</p>
    </div>

    <template v-else-if="viewMode === 'grid'">
      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <li v-for="entry in entries" :key="entry.path" data-testid="workspace-grid-item" class="group card bg-base-100 border-base-300 border">
          <div class="card-body relative gap-2 p-3">
            <input
              type="checkbox"
              class="checkbox checkbox-sm absolute top-2 right-2"
              :checked="selected.includes(entry.path)"
              :aria-label="t('workspace.select', { name: entry.name })"
              @click.stop
              @change="emit('toggleSelect', entry.path)"
            />
            <button class="flex flex-col items-center gap-2 pt-2 text-center" :data-testid="`workspace-entry-${entry.name}`" @dblclick="emit('open', entry)" @click="emit('open', entry)">
              <FolderIcon v-if="entry.type === 'dir'" class="text-primary h-10 w-10" />
              <FileIcon v-else class="h-10 w-10 opacity-60" />
              <span class="w-full truncate text-sm" :title="entry.name">{{ entry.name }}</span>
              <span class="text-base-content/50 text-xs">{{ entry.type === 'dir' ? t('workspace.folder') : formatSize(entry.size) }}</span>
            </button>
            <div class="absolute top-1 left-1">
              <EntryMenu :entry="entry" @download="emit('download', entry)" @rename="emit('rename', entry)" @delete="emit('delete', entry)" @copy="emit('copy', entry)" />
            </div>
          </div>
        </li>
      </ul>
    </template>

    <template v-else>
      <div class="hidden md:block">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th class="w-8"></th>
              <th>{{ t('workspace.name') }}</th>
              <th class="w-24 text-right">{{ t('workspace.size') }}</th>
              <th class="w-48">{{ t('workspace.modified') }}</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.path" :data-testid="`workspace-row-${entry.name}`" class="group">
              <td>
                <input type="checkbox" class="checkbox checkbox-sm" :checked="selected.includes(entry.path)" :aria-label="t('workspace.select', { name: entry.name })" @change="emit('toggleSelect', entry.path)" />
              </td>
              <td class="min-w-0">
                <button class="flex max-w-full min-w-0 items-center gap-2 text-left" @click="emit('open', entry)">
                  <FolderIcon v-if="entry.type === 'dir'" class="text-primary h-4 w-4 shrink-0" />
                  <FileIcon v-else class="h-4 w-4 shrink-0 opacity-60" />
                  <span class="truncate" :title="entry.name">{{ entry.name }}</span>
                  <span v-if="isSensitivePath(entry.path)" class="badge badge-warning badge-xs shrink-0">{{ t('workspace.sensitive') }}</span>
                  <span v-if="entry.type === 'link'" class="badge badge-ghost badge-xs shrink-0">{{ t('workspace.link') }}</span>
                </button>
              </td>
              <td class="text-base-content/60 text-right text-xs whitespace-nowrap">{{ entry.type === 'dir' ? '—' : formatSize(entry.size) }}</td>
              <td class="text-base-content/60 text-xs whitespace-nowrap">{{ formatMtime(entry.mtime, locale) }}</td>
              <td>
                <EntryMenu :entry="entry" @download="emit('download', entry)" @rename="emit('rename', entry)" @delete="emit('delete', entry)" @copy="emit('copy', entry)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="divide-base-300 divide-y md:hidden">
        <li v-for="entry in entries" :key="entry.path" :data-testid="`workspace-card-${entry.name}`" class="flex items-center gap-2 py-2">
          <input type="checkbox" class="checkbox checkbox-sm" :checked="selected.includes(entry.path)" :aria-label="t('workspace.select', { name: entry.name })" @change="emit('toggleSelect', entry.path)" />
          <button class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="emit('open', entry)">
            <FolderIcon v-if="entry.type === 'dir'" class="text-primary h-5 w-5 shrink-0" />
            <FileIcon v-else class="h-5 w-5 shrink-0 opacity-60" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm">{{ entry.name }}</span>
              <span class="text-base-content/50 block truncate text-xs">{{ entry.type === 'dir' ? t('workspace.folder') : formatSize(entry.size) }} · {{ formatMtime(entry.mtime, locale) }}</span>
            </span>
          </button>
          <EntryMenu :entry="entry" @download="emit('download', entry)" @rename="emit('rename', entry)" @delete="emit('delete', entry)" @copy="emit('copy', entry)" />
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import EntryMenu from '@/components/Workspace/EntryMenu.vue';
import FileIcon from '@/components/svg/FileIcon.vue';
import FolderIcon from '@/components/svg/FolderIcon.vue';
import { formatMtime, formatSize, isSensitivePath, type WorkspaceEntry } from '@/config/workspace';
import type { WorkspaceViewMode } from '@/stores/workspaceStore';
import { useI18n } from 'vue-i18n';

defineProps<{
  entries: WorkspaceEntry[];
  viewMode: WorkspaceViewMode;
  selected: string[];
  locale: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  open: [entry: WorkspaceEntry];
  toggleSelect: [path: string];
  download: [entry: WorkspaceEntry];
  rename: [entry: WorkspaceEntry];
  delete: [entry: WorkspaceEntry];
  copy: [entry: WorkspaceEntry];
}>();

const { t } = useI18n();
</script>
