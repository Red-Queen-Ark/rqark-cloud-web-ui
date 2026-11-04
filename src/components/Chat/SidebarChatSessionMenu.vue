<template>
  <!--
    The kebab reuses the row-actions menu: the session list lives in a sidebar
    that scrolls, so a dropdown rendered inside the row would be clipped by the
    scroller as soon as the session sits near the bottom. The shared menu
    teleports itself to the body and hangs off the button instead.
  -->
  <div class="pointer-events-auto">
    <RowActionsMenu :label="t('chat.more')" trigger-test-id="sidebar-chat-session-menu-button" menu-test-id="sidebar-chat-session-menu" :trigger-class="triggerClass">
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
    </RowActionsMenu>
  </div>

  <Teleport to="body">
    <FormModal v-if="confirming" :title="t('chat.deleteConfirm')" :confirm-label="t('chat.delete')" :cancel-label="t('chat.cancel')" confirm-class="btn-error" :saving="deleting" @confirm="remove" @cancel="confirming = false" />
  </Teleport>
</template>

<script setup lang="ts">
import { deleteSessionsByUuid } from '@/api';
import PencilIcon from '@/components/svg/PencilIcon.vue';
import TrashIcon from '@/components/svg/TrashIcon.vue';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ sessionId?: string; active?: boolean }>();

const emit = defineEmits<{ edit: []; deleted: [id: string] }>();

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();

/** The row this button sits on is filled with `neutral`, so base-content would vanish into it. */
const triggerClass = computed(() =>
  [
    'border-transparent rounded-full opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
    props.active ? 'text-neutral-content/70 hover:bg-neutral-content/10 active:bg-neutral-content/10' : 'text-base-content/60',
  ].join(' '),
);

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
