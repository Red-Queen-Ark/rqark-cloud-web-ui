<template>
  <div data-testid="workspace-page" class="flex min-h-0 flex-col gap-3 lg:flex-row lg:gap-4">
    <section class="flex min-w-0 flex-1 flex-col gap-3">
      <FileBreadcrumb :path="path" :root-label="t('workspace.root')" @navigate="openPath" />

      <FileToolbar
        :path="path"
        :query="query"
        :show-hidden="showHidden"
        :view-mode="viewMode"
        :selected-count="selected.length"
        :busy="loading"
        @up="goUp"
        @refresh="refresh"
        @upload="upload"
        @new-file="startCreate('file')"
        @new-folder="startCreate('dir')"
        @search="query = $event"
        @toggle-hidden="toggleHidden"
        @toggle-view="toggleView"
        @download-selected="downloadSelected"
        @delete-selected="askDeleteSelected"
        @clear-selection="selected = []"
      />

      <div v-if="uploading" data-testid="workspace-upload-progress" class="alert alert-info py-2">
        <progress class="progress progress-primary w-40" :value="uploadPercent" max="100"></progress>
        <span class="text-sm">{{ t('workspace.uploading', { percent: uploadPercent }) }}</span>
      </div>

      <UploadDropzone :target="path" @files="upload">
        <FileList
          :entries="visibleEntries"
          :view-mode="viewMode"
          :selected="selected"
          :locale="locale"
          :loading="loading"
          @open="open"
          @toggle-select="toggleSelect"
          @download="download"
          @rename="askRename"
          @delete="askDelete"
          @copy="copyPath"
        />
      </UploadDropzone>
    </section>

    <FilePreview v-if="preview" :entry="preview" @close="preview = null" @download="download" @saved="handleSaved" />

    <NewItemModal
      v-if="creating"
      :title="creating === 'dir' ? t('workspace.newFolder') : t('workspace.newFile')"
      :label="t('workspace.name')"
      :placeholder="creating === 'dir' ? t('workspace.folderPlaceholder') : t('workspace.filePlaceholder')"
      :confirm-label="t('workspace.create')"
      :saving="mutating"
      @confirm="create"
      @cancel="creating = null"
    />

    <RenameModal v-if="renaming" :entry="renaming" :saving="mutating" @confirm="rename" @cancel="renaming = null" />

    <FormModal
      v-if="deleting"
      :title="t('workspace.deleteTitle')"
      :description="deleting.length === 1 ? deleting[0] : t('workspace.deleteMany', { count: deleting.length })"
      :confirm-label="t('workspace.delete')"
      :cancel-label="t('workspace.cancel')"
      confirm-class="btn-error"
      :saving="mutating"
      @confirm="remove"
      @cancel="deleting = null"
    />
  </div>
</template>

<script setup lang="ts">
import FileBreadcrumb from '@/components/Workspace/FileBreadcrumb.vue';
import FileList from '@/components/Workspace/FileList.vue';
import FilePreview from '@/components/Workspace/FilePreview.vue';
import FileToolbar from '@/components/Workspace/FileToolbar.vue';
import NewItemModal from '@/components/Workspace/NewItemModal.vue';
import RenameModal from '@/components/Workspace/RenameModal.vue';
import UploadDropzone from '@/components/Workspace/UploadDropzone.vue';
import FormModal from '@/components/FormModal.vue';
import { deleteWorkspaceEntry, downloadWorkspaceArchive, downloadWorkspaceFile, listWorkspace, makeWorkspaceDirectory, moveWorkspaceEntry, uploadWorkspaceFiles, writeWorkspaceFile, type UploadProgress } from '@/api-client/workspace';
import { apiErrorCode } from '@/api-client/error';
import { joinPath, parentOf, type WorkspaceEntry } from '@/config/workspace';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { saveBlob } from '@/utils/download';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const alertStore = useAlertStore();
const apiError = useApiError();
const store = useWorkspaceStore();

const path = computed(() => store.path);
const showHidden = computed(() => store.showHidden);
const viewMode = computed(() => store.viewMode);

const entries = ref<WorkspaceEntry[]>([]);
const loading = ref(false);
const refreshKey = ref(0);
const query = ref('');
const selected = ref<string[]>([]);
const preview = ref<WorkspaceEntry | null>(null);
const creating = ref<'file' | 'dir' | null>(null);
const renaming = ref<WorkspaceEntry | null>(null);
const deleting = ref<string[] | null>(null);
const mutating = ref(false);
const uploading = ref(false);
const uploadPercent = ref(0);

const visibleEntries = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return needle ? entries.value.filter((entry) => entry.name.toLowerCase().includes(needle)) : entries.value;
});

async function load() {
  loading.value = true;
  try {
    const listing = await listWorkspace(store.path, store.showHidden);
    entries.value = listing.entries;
  } catch (failure) {
    if (apiErrorCode(failure) === 'FILE_NOT_FOUND' && store.path !== '') {
      store.resetPath();
      return;
    }
    alertStore.addItem({ level: 'error', message: apiError(failure, 'workspace.listError') });
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

function syncQuery(next: string) {
  const current = typeof route.query.path === 'string' ? route.query.path : '';
  if (current === next) {
    return;
  }
  void router.replace({ query: next ? { path: next } : {} });
}

function openPath(next: string) {
  if (next === store.path) {
    void refresh();
    return;
  }
  selected.value = [];
  query.value = '';
  store.setPath(next);
}

function goUp() {
  openPath(parentOf(store.path));
}

async function refresh() {
  await load();
  refreshKey.value += 1;
}

function open(entry: WorkspaceEntry) {
  if (entry.type === 'dir') {
    openPath(entry.path);
    return;
  }
  preview.value = entry;
}

function toggleSelect(entryPath: string) {
  selected.value = selected.value.includes(entryPath) ? selected.value.filter((item) => item !== entryPath) : [...selected.value, entryPath];
}

function toggleHidden() {
  store.setShowHidden(!store.showHidden);
  void refresh();
}

function toggleView() {
  store.setViewMode(store.viewMode === 'list' ? 'grid' : 'list');
}

async function download(entry: WorkspaceEntry) {
  try {
    const file = entry.type === 'dir' ? await downloadWorkspaceArchive(entry.path, `${entry.name}.zip`) : await downloadWorkspaceFile(entry.path, entry.name);
    saveBlob(file.blob, file.filename);
  } catch (failure) {
    alertStore.addItem({ level: 'error', message: apiError(failure, 'workspace.downloadError') });
  }
}

async function downloadSelected() {
  const chosen = entries.value.filter((entry) => selected.value.includes(entry.path));
  for (const entry of chosen) {
    await download(entry);
  }
}

function startCreate(kind: 'file' | 'dir') {
  creating.value = kind;
}

async function create(name: string) {
  if (!creating.value) {
    return;
  }
  mutating.value = true;
  const target = joinPath(store.path, name);
  try {
    if (creating.value === 'dir') {
      await makeWorkspaceDirectory(target);
    } else {
      await writeWorkspaceFile(target, '');
    }
    creating.value = null;
    await refresh();
  } catch (failure) {
    alertStore.addItem({ level: 'error', message: apiError(failure, 'workspace.createError') });
  } finally {
    mutating.value = false;
  }
}

function askRename(entry: WorkspaceEntry) {
  renaming.value = entry;
}

async function rename(newPath: string) {
  const entry = renaming.value;
  if (!entry) {
    return;
  }
  mutating.value = true;
  try {
    await moveWorkspaceEntry(entry.path, newPath);
    if (preview.value?.path === entry.path) {
      preview.value = null;
    }
    renaming.value = null;
    await refresh();
  } catch (failure) {
    alertStore.addItem({ level: 'error', message: apiError(failure, 'workspace.renameError') });
  } finally {
    mutating.value = false;
  }
}

function askDelete(entry: WorkspaceEntry) {
  deleting.value = [entry.path];
}

function askDeleteSelected() {
  deleting.value = [...selected.value];
}

async function remove() {
  const targets = deleting.value ?? [];
  mutating.value = true;
  try {
    for (const target of targets) {
      await deleteWorkspaceEntry(target);
    }
    deleting.value = null;
    selected.value = [];
    if (preview.value && targets.includes(preview.value.path)) {
      preview.value = null;
    }
    await refresh();
  } catch (failure) {
    alertStore.addItem({ level: 'error', message: apiError(failure, 'workspace.deleteError') });
  } finally {
    mutating.value = false;
  }
}

async function copyPath(entry: WorkspaceEntry) {
  try {
    await navigator.clipboard.writeText(entry.path);
    alertStore.addItem({ level: 'success', message: t('workspace.copied', { path: entry.path }) });
  } catch {
    alertStore.addItem({ level: 'error', message: t('workspace.copyError') });
  }
}

async function upload(files: File[]) {
  uploading.value = true;
  uploadPercent.value = 0;
  try {
    await uploadWorkspaceFiles(store.path, files, (progress: UploadProgress) => {
      uploadPercent.value = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
    });
    alertStore.addItem({ level: 'success', message: t('workspace.uploadSuccess', { count: files.length }) });
    await refresh();
  } catch (failure) {
    alertStore.addItem({ level: 'error', message: apiError(failure, 'workspace.uploadError') });
  } finally {
    uploading.value = false;
    uploadPercent.value = 0;
  }
}

function handleSaved(entry: WorkspaceEntry) {
  if (preview.value?.path === entry.path) {
    preview.value = entry;
  }
  void refresh();
}

let focusTimer: ReturnType<typeof setTimeout> | undefined;

function onFocus() {
  if (creating.value || renaming.value || deleting.value || uploading.value) {
    return;
  }
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => void load(), 250);
}

watch(
  () => store.path,
  (next) => {
    syncQuery(next);
    selected.value = [];
    void refresh();
  },
);

onMounted(() => {
  window.addEventListener('focus', onFocus);
  const initial = typeof route.query.path === 'string' ? route.query.path : store.path;
  if (initial !== store.path) {
    store.setPath(initial);
    return;
  }
  syncQuery(store.path);
  void refresh();
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', onFocus);
  clearTimeout(focusTimer);
});
</script>
