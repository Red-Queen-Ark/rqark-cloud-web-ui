<template>
  <div class="space-y-4">
    <DataToolbar>
      <p class="text-base-content/70 max-w-md text-xs">{{ t('sops.hint') }}</p>
      <template #actions>
        <button data-testid="sops-create" class="btn btn-primary btn-sm" @click="openCreate">{{ t('sops.create') }}</button>
      </template>
    </DataToolbar>

    <DataListPanel
      :loading="loading"
      :loading-label="t('sops.loading')"
      :empty="sops.length === 0"
      :empty-title="t('sops.empty')"
      :empty-description="t('sops.emptyDesc')"
      :empty-action-label="t('sops.create')"
      empty-action-id="sops-empty-create"
      @create="openCreate"
    >
      <div class="scrollbar-thin table-scroll overflow-x-auto">
        <table class="table table-pin-rows w-full whitespace-nowrap">
          <thead>
            <tr>
              <th>{{ t('sops.slug') }}</th>
              <th>{{ t('sops.titleColumn') }}</th>
              <th>{{ t('sops.updated') }}</th>
              <th class="bg-base-200 sticky right-0 text-right">{{ t('sops.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sop in sops" :key="sop.slug" :data-testid="`sop-row-${sop.slug}`">
              <td class="font-mono font-medium" :data-testid="`sop-slug-${sop.slug}`">{{ sop.slug }}</td>
              <td class="text-base-content/70 max-w-xs truncate">{{ sop.title || '—' }}</td>
              <td class="text-base-content/70">{{ formatDateTime(sop.updated_at) }}</td>
              <td class="bg-base-200 sticky right-0 text-right">
                <div class="flex items-center justify-end gap-1">
                  <RowActionsMenu>
                    <li>
                      <button :data-testid="`sop-edit-${sop.slug}`" @click="openEdit(sop)">{{ t('sops.edit') }}</button>
                    </li>
                    <li>
                      <button class="text-error" :data-testid="`sop-delete-${sop.slug}`" @click="deleteTarget = sop">{{ t('sops.delete') }}</button>
                    </li>
                  </RowActionsMenu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="nextCursor" class="flex items-center justify-center pt-2">
        <button class="btn btn-ghost btn-sm" data-testid="sops-load-more" :disabled="loadingMore" @click="loadMore">
          <span v-if="loadingMore" class="loading loading-spinner loading-xs"></span>
          {{ t('sops.loadMore') }}
        </button>
      </div>
    </DataListPanel>

    <FormModal
      v-if="editor.open"
      wide
      :title="editor.mode === 'create' ? t('sops.create') : t('sops.edit')"
      :description="t('sops.editorDescription')"
      :confirm-label="t('sops.save')"
      :cancel-label="t('sops.cancel')"
      :saving="saving"
      @cancel="closeEditor"
      @confirm="save"
    >
      <label class="fieldset">
        <span class="fieldset-legend">{{ t('sops.slug') }}</span>
        <input id="sop-slug" v-model="editor.slug" data-testid="sop-slug-input" type="text" class="input w-full font-mono" :disabled="editor.mode === 'edit'" :placeholder="t('sops.slugPlaceholder')" />
        <span class="label">{{ t('sops.slugHint') }}</span>
      </label>

      <label class="fieldset">
        <span class="fieldset-legend">{{ t('sops.content') }}</span>
        <textarea id="sop-content" v-model="editor.content" data-testid="sop-content-input" class="textarea h-64 w-full font-mono text-sm" :placeholder="t('sops.contentPlaceholder')"></textarea>
        <span class="label" :class="tooLong ? 'text-error' : ''" data-testid="sop-char-count">{{ t('sops.charCount', { count: contentLength, max: SOP_CONTENT_MAX_LENGTH }) }}</span>
      </label>
    </FormModal>

    <FormModal
      v-if="deleteTarget"
      :title="t('sops.deleteTitle')"
      :description="t('sops.deleteConfirm', { slug: deleteTarget.slug })"
      confirm-class="btn-error"
      :confirm-label="t('sops.delete')"
      :cancel-label="t('sops.cancel')"
      :saving="deleting"
      @cancel="deleteTarget = null"
      @confirm="removeSop"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiSopDto } from '@/api';
import { deleteSopsBySlug, getSops, getSopsBySlug, patchSopsBySlug, postSops } from '@/api';
import { apiErrorCode } from '@/api-client/error';
import DataListPanel from '@/components/DataListPanel.vue';
import DataToolbar from '@/components/DataToolbar.vue';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import { useApiError } from '@/composables/useApiError';
import { SOP_CONTENT_MAX_LENGTH } from '@/config/limits';
import { useAlertStore } from '@/stores/alertStore';
import { formatDateTime } from '@/utils/datetime';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const PAGE_SIZE = 100;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

interface Editor {
  open: boolean;
  mode: 'create' | 'edit';
  original: string;
  slug: string;
  content: string;
}

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();

const sops = ref<ApiSopDto[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const nextCursor = ref('');
const saving = ref(false);
const deleting = ref(false);
const deleteTarget = ref<ApiSopDto | null>(null);

const editor = reactive<Editor>({ open: false, mode: 'create', original: '', slug: '', content: '' });

const contentLength = computed(() => [...editor.content].length);
const tooLong = computed(() => contentLength.value > SOP_CONTENT_MAX_LENGTH);

function openCreate() {
  Object.assign(editor, { open: true, mode: 'create', original: '', slug: '', content: '' });
}

async function openEdit(sop: ApiSopDto) {
  const slug = sop.slug ?? '';
  if (!slug) {
    return;
  }

  const result = await getSopsBySlug({ path: { slug } });
  if (result.error || !result.data) {
    alertStore.addItem({ level: 'error', message: apiError(result.error, 'sops.loadError') });
    return;
  }

  Object.assign(editor, { open: true, mode: 'edit', original: slug, slug, content: result.data.content ?? '' });
}

function closeEditor() {
  editor.open = false;
}

async function loadPage(cursor: string) {
  return getSops({ query: { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) } });
}

async function load() {
  loading.value = true;
  const result = await loadPage('');
  loading.value = false;

  if (result.error || !result.data) {
    sops.value = [];
    nextCursor.value = '';
    alertStore.addItem({ level: 'error', message: apiError(result.error, 'sops.loadError') });
    return;
  }

  sops.value = result.data.items ?? [];
  nextCursor.value = result.data.next_cursor ?? '';
}

async function loadMore() {
  loadingMore.value = true;
  const result = await loadPage(nextCursor.value);
  loadingMore.value = false;

  if (result.error || !result.data) {
    alertStore.addItem({ level: 'error', message: apiError(result.error, 'sops.loadError') });
    return;
  }

  sops.value = [...sops.value, ...(result.data.items ?? [])];
  nextCursor.value = result.data.next_cursor ?? '';
}

async function save() {
  const slug = editor.slug.trim();

  if (editor.mode === 'create' && !SLUG_PATTERN.test(slug)) {
    alertStore.addItem({ level: 'warning', message: t('sops.slugInvalid') });
    return;
  }
  if (editor.content.trim() === '') {
    alertStore.addItem({ level: 'warning', message: t('sops.contentRequired') });
    return;
  }
  if (tooLong.value) {
    alertStore.addItem({ level: 'warning', message: t('sops.contentTooLong', { max: SOP_CONTENT_MAX_LENGTH }) });
    return;
  }

  saving.value = true;
  const { data, error } = editor.mode === 'create' ? await postSops({ body: { slug, content: editor.content } }) : await patchSopsBySlug({ path: { slug: editor.original }, body: { content: editor.content } });
  saving.value = false;

  if (error || !data) {
    const message = apiErrorCode(error) === 'CONFLICT' ? t('sops.slugTaken') : apiError(error, 'sops.saveError');
    alertStore.addItem({ level: 'error', message });
    return;
  }

  editor.open = false;
  alertStore.addItem({ level: 'success', message: t('sops.saved') });
  void load();
}

async function removeSop() {
  const target = deleteTarget.value;
  if (!target?.slug) {
    return;
  }

  deleting.value = true;
  const { error } = await deleteSopsBySlug({ path: { slug: target.slug } });
  deleting.value = false;
  deleteTarget.value = null;

  if (error) {
    alertStore.addItem({ level: 'error', message: apiError(error, 'sops.deleteError') });
    return;
  }

  sops.value = sops.value.filter((sop) => sop.slug !== target.slug);
  alertStore.addItem({ level: 'success', message: t('sops.deleted') });
}

onMounted(load);
</script>
