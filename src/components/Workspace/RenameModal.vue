<template>
  <NewItemModal
    :title="t('workspace.renameTitle', { name: entry.name })"
    :label="t('workspace.newPath')"
    :placeholder="entry.path"
    :initial="entry.path"
    :confirm-label="t('workspace.rename')"
    :description="t('workspace.renameHint')"
    :saving="saving"
    allow-slash
    @confirm="emit('confirm', $event)"
    @cancel="emit('cancel')"
  />
</template>

<script setup lang="ts">
import NewItemModal from '@/components/Workspace/NewItemModal.vue';
import type { WorkspaceEntry } from '@/config/workspace';
import { useI18n } from 'vue-i18n';

defineProps<{ entry: WorkspaceEntry; saving: boolean }>();

const emit = defineEmits<{ confirm: [newPath: string]; cancel: [] }>();

const { t } = useI18n();
</script>
