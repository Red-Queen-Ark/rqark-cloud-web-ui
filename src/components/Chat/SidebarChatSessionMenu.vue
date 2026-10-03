<template>
  <div class="dropdown dropdown-end pointer-events-auto">
    <button
      type="button"
      tabindex="0"
      data-testid="sidebar-chat-session-menu-button"
      class="btn btn-ghost btn-square  btn-xs border-transparent opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      :class="active ? 'text-neutral-content/70 hover:bg-neutral-content/10 active:bg-neutral-content/10' : 'text-base-content/60'"
      :title="t('chat.more')"
    >
      <EllipsisVerticalIcon class="h-4 w-4" />
    </button>
    <ul tabindex="0" data-testid="sidebar-chat-session-menu" class="dropdown-content menu bg-base-200 rounded-box z-50 w-44 p-1 shadow-md">
      <li>
        <button data-testid="sidebar-chat-session-edit" @click="choose('edit')">
          <PencilIcon class="h-3 w-3" />
          {{ t('chat.edit') }}
        </button>
      </li>
      <li>
        <button data-testid="sidebar-chat-session-delete" class="text-error" @click="choose('delete')">
          <TrashIcon class="h-3 w-3" />
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
import EllipsisVerticalIcon from '@/components/svg/EllipsisVerticalIcon.vue';
import PencilIcon from '@/components/svg/PencilIcon.vue';
import TrashIcon from '@/components/svg/TrashIcon.vue';
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
