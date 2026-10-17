<template>
  <div data-testid="workspace-preview" class="modal modal-open">
    <div class="modal-box flex max-h-[90vh] w-11/12 max-w-5xl flex-col">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="flex items-center gap-2 truncate text-lg font-bold">
            <FileIcon class="h-5 w-5 shrink-0 opacity-60" />
            <span class="truncate" data-testid="workspace-preview-name">{{ entry.name }}</span>
            <span v-if="sensitive" class="badge badge-warning badge-sm">{{ t('workspace.sensitive') }}</span>
          </h3>
          <p class="text-base-content/60 text-xs">{{ entry.path }} · {{ formatSize(entry.size) }} · {{ formatMtime(entry.mtime, locale) }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button data-testid="workspace-preview-download" class="btn btn-sm" :title="t('workspace.download')" @click="emit('download', entry)">
            <DownloadIcon class="h-4 w-4" />
          </button>
          <button data-testid="workspace-preview-close" class="btn btn-ghost btn-sm btn-square" :title="t('workspace.close')" @click="emit('close')">
            <CloseIcon class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-auto py-3">
        <div v-if="loading" data-testid="workspace-preview-loading" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <div v-else-if="sensitive" data-testid="workspace-preview-sensitive" class="alert alert-warning">
          <span>{{ t('workspace.sensitiveHint') }}</span>
        </div>

        <div v-else-if="kind === 'binary'" data-testid="workspace-preview-binary" class="flex flex-col items-center gap-3 py-16 text-center">
          <FileIcon class="h-14 w-14 opacity-30" />
          <p>{{ t('workspace.binaryHint') }}</p>
          <button class="btn btn-primary btn-sm" @click="emit('download', entry)">
            <DownloadIcon class="h-4 w-4" />
            {{ t('workspace.download') }}
          </button>
        </div>

        <img v-else-if="kind === 'image' && objectUrl" data-testid="workspace-preview-image" :src="objectUrl" :alt="entry.name" class="mx-auto max-h-[65vh] max-w-full object-contain" />

        <iframe v-else-if="kind === 'pdf' && objectUrl" data-testid="workspace-preview-pdf" :src="objectUrl" :title="entry.name" class="h-[65vh] w-full rounded-box border border-base-300"></iframe>

        <div v-else-if="editing" class="flex h-full flex-col">
          <textarea v-model="draft" data-testid="workspace-preview-editor" class="textarea textarea-bordered h-[55vh] w-full font-mono text-xs leading-relaxed"></textarea>
        </div>

        <MessageBody v-else-if="kind === 'markdown'" :html="html" :raw="text ?? ''" />

        <pre v-else data-testid="workspace-preview-text" class="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">{{ text }}</pre>

        <div v-if="error" data-testid="workspace-preview-error" class="alert alert-error mt-3 text-sm">{{ error }}</div>
      </div>

      <div v-if="editable" class="mt-2 flex items-center justify-end gap-2">
        <template v-if="editing">
          <button class="btn btn-ghost btn-sm" @click="cancelEdit">{{ t('workspace.cancel') }}</button>
          <button data-testid="workspace-preview-save" class="btn btn-primary btn-sm" :disabled="saving || draft === text" @click="save">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            {{ t('workspace.save') }}
          </button>
        </template>
        <button v-else data-testid="workspace-preview-edit" class="btn btn-sm" @click="editing = true">
          <PencilIcon class="h-4 w-4" />
          {{ t('workspace.edit') }}
        </button>
      </div>
    </div>
    <label class="modal-backdrop" @click="emit('close')"></label>
  </div>
</template>

<script setup lang="ts">
import MessageBody from '@/components/Session/MessageBody.vue';
import CloseIcon from '@/components/svg/CloseIcon.vue';
import DownloadIcon from '@/components/svg/DownloadIcon.vue';
import FileIcon from '@/components/svg/FileIcon.vue';
import PencilIcon from '@/components/svg/PencilIcon.vue';
import { downloadWorkspaceFile, writeWorkspaceFile } from '@/api-client/workspace';
import { formatMtime, formatSize, isSensitivePath, previewKind, type WorkspaceEntry } from '@/config/workspace';
import { useAlertStore } from '@/stores/alertStore';
import { renderMarkdown } from '@/utils/markdown';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useApiError } from '@/composables/useApiError';

const props = defineProps<{ entry: WorkspaceEntry }>();

const emit = defineEmits<{
  close: [];
  saved: [entry: WorkspaceEntry];
  download: [entry: WorkspaceEntry];
}>();

const { t, locale } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();

const kind = computed(() => previewKind(props.entry));
const sensitive = computed(() => isSensitivePath(props.entry.path));
const editable = computed(() => (kind.value === 'text' || kind.value === 'markdown') && !sensitive.value);

const loading = ref(false);
const error = ref('');
const text = ref<string | null>(null);
const draft = ref('');
const editing = ref(false);
const saving = ref(false);
const objectUrl = ref('');

const html = computed(() => (kind.value === 'markdown' ? renderMarkdown(text.value) : null));

async function load() {
  if (sensitive.value || kind.value === 'binary') {
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const { blob } = await downloadWorkspaceFile(props.entry.path, props.entry.name);
    if (kind.value === 'image' || kind.value === 'pdf') {
      objectUrl.value = URL.createObjectURL(blob);
    } else {
      text.value = await blob.text();
      draft.value = text.value;
    }
  } catch (failure) {
    error.value = apiError(failure, 'workspace.loadFileError');
  } finally {
    loading.value = false;
  }
}

function cancelEdit() {
  draft.value = text.value ?? '';
  editing.value = false;
}

async function save() {
  saving.value = true;
  try {
    const saved = await writeWorkspaceFile(props.entry.path, draft.value, props.entry.mtime);
    text.value = draft.value;
    editing.value = false;
    emit('saved', saved);
    alertStore.addItem({ level: 'success', message: t('workspace.saveSuccess', { name: props.entry.name }) });
  } catch (failure) {
    alertStore.addItem({ level: 'error', message: apiError(failure, 'workspace.saveError') });
  } finally {
    saving.value = false;
  }
}

onMounted(load);

onBeforeUnmount(() => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
  }
});
</script>
