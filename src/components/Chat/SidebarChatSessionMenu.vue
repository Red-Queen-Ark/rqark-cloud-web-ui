<template>
  <div class="dropdown dropdown-end pointer-events-auto">
    <button
      type="button"
      tabindex="0"
      data-testid="sidebar-chat-session-menu-button"
      class="btn btn-ghost btn-circle btn-xs border-transparent opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      :class="active ? 'text-neutral-content/70 hover:bg-neutral-content/10 active:bg-neutral-content/10' : 'text-base-content/60'"
      :title="t('chat.more')"
    >
      <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a2 2 0 110 4 2 2 0 010-4zM10 8a2 2 0 110 4 2 2 0 010-4zM10 14a2 2 0 110 4 2 2 0 010-4z" /></svg>
    </button>
    <ul tabindex="0" data-testid="sidebar-chat-session-menu" class="dropdown-content menu bg-base-200 rounded-box z-50 w-44 p-1 shadow-md">
      <li>
        <button data-testid="sidebar-chat-session-edit" @click="choose('edit')">
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {{ t('chat.edit') }}
        </button>
      </li>
      <li>
        <button data-testid="sidebar-chat-session-delete" class="text-error" @click="choose('delete')">
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {{ t('chat.delete') }}
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <FormModal v-if="confirming" :title="t('chat.deleteConfirm')" :confirm-label="t('chat.delete')" :cancel-label="t('chat.cancel')" confirm-class="btn-error" :saving="deleting" @confirm="remove" @cancel="confirming = false" />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { deleteSessionsByUuid } from '@/api';
import FormModal from '@/components/FormModal.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ sessionId?: string; active?: boolean }>();

const emit = defineEmits<{ edit: []; deleted: [id: string] }>();

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();

const confirming = ref(false);
const deleting = ref(false);

function choose(action: 'edit' | 'delete') {
  (document.activeElement as HTMLElement | null)?.blur();
  if (action === 'edit') {
    emit('edit');
    return;
  }
  confirming.value = true;
}

async function remove() {
  const id = props.sessionId;
  if (!id || deleting.value) {
    return;
  }
  deleting.value = true;
  try {
    const { error } = await deleteSessionsByUuid({ path: { uuid: id } });
    if (error) {
      alertStore.addItem({ level: 'error', message: apiError(error, 'chat.deleteError') });
      return;
    }
    confirming.value = false;
    emit('deleted', id);
  } finally {
    deleting.value = false;
  }
}
</script>
