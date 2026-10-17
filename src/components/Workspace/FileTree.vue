<template>
  <ul class="menu menu-sm w-full gap-0.5 p-0" :data-testid="depth === 0 ? 'workspace-tree' : undefined">
    <li v-if="depth === 0">
      <button :class="{ 'menu-active': currentPath === '' }" data-testid="workspace-tree-root" @click="emit('navigate', '')">
        <HomeIcon class="h-4 w-4" />
        <span class="truncate">{{ rootLabel }}</span>
      </button>
    </li>
    <li v-for="folder in folders" :key="folder.path">
      <div class="flex items-center gap-0.5" :class="{ 'menu-active': currentPath === folder.path }">
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square shrink-0"
          :aria-expanded="expanded[folder.path] === true"
          :aria-label="expanded[folder.path] ? t('workspace.collapse') : t('workspace.expand')"
          @click.stop="toggle(folder)"
        >
          <ChevronRightIcon class="h-3.5 w-3.5 transition-transform" :class="{ 'rotate-90': expanded[folder.path] }" />
        </button>
        <button type="button" class="flex min-w-0 flex-1 items-center gap-1.5 text-left" :data-testid="`workspace-tree-${folder.path}`" @click="emit('navigate', folder.path)">
          <FolderIcon class="text-primary h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ folder.name }}</span>
        </button>
      </div>
      <FileTree v-if="expanded[folder.path]" :path="folder.path" :current-path="currentPath" :show-hidden="showHidden" :refresh-key="refreshKey" :depth="depth + 1" :root-label="rootLabel" @navigate="emit('navigate', $event)" />
    </li>
  </ul>
</template>

<script setup lang="ts">
import ChevronRightIcon from '@/components/svg/ChevronRightIcon.vue';
import FolderIcon from '@/components/svg/FolderIcon.vue';
import HomeIcon from '@/components/svg/HomeIcon.vue';
import { listWorkspace } from '@/api-client/workspace';
import type { WorkspaceEntry } from '@/config/workspace';
import { onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    path: string;
    currentPath: string;
    showHidden: boolean;
    refreshKey: number;
    depth?: number;
    rootLabel: string;
  }>(),
  { depth: 0 },
);

const emit = defineEmits<{ navigate: [path: string] }>();

const { t } = useI18n();
const folders = ref<WorkspaceEntry[]>([]);
const expanded = reactive<Record<string, boolean>>({});

async function load() {
  try {
    const listing = await listWorkspace(props.path, props.showHidden);
    folders.value = listing.entries.filter((entry) => entry.type === 'dir');
    for (const folder of folders.value) {
      if (props.currentPath === folder.path || props.currentPath.startsWith(`${folder.path}/`)) {
        expanded[folder.path] = true;
      }
    }
  } catch {
    folders.value = [];
  }
}

async function toggle(folder: WorkspaceEntry) {
  if (expanded[folder.path]) {
    expanded[folder.path] = false;
    return;
  }
  expanded[folder.path] = true;
  await load();
}

onMounted(load);

watch(
  () => props.refreshKey,
  () => {
    void load();
  },
);

watch(
  () => props.showHidden,
  () => {
    void load();
  },
);
</script>
