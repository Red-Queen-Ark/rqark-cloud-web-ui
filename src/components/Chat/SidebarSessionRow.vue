<template>
  <li class="group relative min-w-0">
    <template v-if="session.id">
      <RouterLink :to="{ name: 'chat', params: { lang, uuid: session.id } }" :class="{ 'menu-active': active, invisible: editing }" class="flex min-w-0 items-center gap-2 pr-8">
        <span class="min-w-0 truncate">{{ session.title || t('sessions.untitled') }}</span>
      </RouterLink>

      <div class="pointer-events-none absolute inset-y-0 right-1 flex items-center hover:bg-transparent active:bg-transparent" :class="{ invisible: editing }">
        <SidebarChatSessionMenu :session-id="session.id" :active="active" @edit="startEdit" @deleted="emit('deleted', session.id as string)" />
      </div>

      <div v-if="editing" class="absolute inset-0 flex! items-center gap-1 px-3">
        <input ref="input" v-model="title" :data-edit-id="session.id" type="text" class="input input-sm w-full min-w-0" :placeholder="t('chat.titlePlaceholder')" @keydown="handleKeydown" @blur="save" />
        <button data-testid="sidebar-chat-rename-save" class="btn btn-ghost btn-sm btn-square text-success" :title="t('chat.edit')" @mousedown.prevent @click="save">
          <CheckIcon class="h-3.5 w-3.5" />
        </button>
        <button data-testid="sidebar-chat-rename-cancel" class="btn btn-ghost btn-sm btn-square text-error" :title="t('chat.cancel')" @mousedown.prevent @click="cancel">
          <CloseIcon class="h-3.5 w-3.5" />
        </button>
      </div>
    </template>
    <span v-else class="truncate">{{ session.title || t('sessions.untitled') }}</span>
  </li>
</template>

<script setup lang="ts">
import { putSessionsByUuid, type ApiSessionDto } from '@/api';
import CheckIcon from '@/components/svg/CheckIcon.vue';
import CloseIcon from '@/components/svg/CloseIcon.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { useChatStore } from '@/stores/chatStore';
import { nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SidebarChatSessionMenu from './SidebarChatSessionMenu.vue';

const props = defineProps<{
  session: ApiSessionDto;
  lang: string;
  active: boolean;
}>();

const emit = defineEmits<{ deleted: [id: string]; renamed: [id: string, title: string] }>();

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();
const chatStore = useChatStore();

const editing = ref(false);
const title = ref('');
const saving = ref(false);
const input = ref<HTMLInputElement | null>(null);

function startEdit() {
  if (!props.session.id) {
    return;
  }
  editing.value = true;
  title.value = props.session.title ?? '';
  void nextTick(() => {
    // preventScroll: the row is already visible, and letting focus scroll the list is itself a visible jump.
    input.value?.focus({ preventScroll: true });
    input.value?.select();
  });
}

function cancel() {
  editing.value = false;
  title.value = '';
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    void save();
  } else if (event.key === 'Escape') {
    cancel();
  }
}

async function save() {
  const id = props.session.id;
  if (!id || saving.value) {
    return;
  }
  const next = title.value.trim();
  // An unchanged or emptied title is treated as a cancel, matching the app's other inline edits.
  if (!next || props.session.title === next) {
    cancel();
    return;
  }
  saving.value = true;
  try {
    const { error } = await putSessionsByUuid({ path: { uuid: id }, body: { title: next } });
    if (error) {
      alertStore.addItem({ level: 'error', message: apiError(error, 'chat.renameError') });
      return;
    }
    // The row cannot write to the session it was handed: the list owns the
    // array, so the new title is reported and it writes it.
    emit('renamed', id, next);
    chatStore.setSessionTitle(id, next);
    cancel();
  } finally {
    saving.value = false;
  }
}
</script>
