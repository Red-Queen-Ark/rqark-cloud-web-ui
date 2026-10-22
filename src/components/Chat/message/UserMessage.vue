<template>
  <div>
    <div data-testid="user-message" class="rounded-xl bg-base-300 w-fit min-w-[min(24rem,90%)] max-w-[90%] ms-auto px-4 py-2">
      <template v-for="(info, index) in props.message.content" :key="`user-${info.type}-${index}`">
        <MessageBody v-if="info.type === 'text'" :html="renderMarkdown(info.text)" :raw="info.text" />
        <div v-else-if="info.type === 'image_url'">
          <!-- info.image_url -->
        </div>
      </template>
    </div>
    <div class="flex justify-end items-center gap-1.5">
      <p v-if="props.message.created_at" data-testid="user-message-time" class="text-base-content/40 mt-1 text-end text-xs pr-1">{{ formatDateTime(props.message.created_at) }}</p>
      <div v-if="text">
        <button type="button" data-testid="user-message-copy" class="btn btn-ghost btn-square btn-xs text-success" :title="t('chat.copy')" :aria-label="t('chat.copy')" @click="copy">
          <CopyIcon class="h-3.5 w-3.5" />
        </button>
      </div>
      <div v-if="props.revertible">
        <button type="button" data-testid="user-message-revert" class="btn btn-ghost btn-square btn-xs text-warning" :title="t('chat.revert')" :disabled="props.busy" @click="ask">
          <RevertIcon class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    <Teleport to="body">
      <FormModal v-if="confirming" :title="t('chat.revertTitle')" :description="t('chat.revertConfirm')" :confirm-label="t('chat.revert')" :cancel-label="t('chat.cancel')" confirm-class="btn-warning" @confirm="confirm" @cancel="cancel" />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import FormModal from '@/components/FormModal.vue';
import MessageBody from '@/components/Session/MessageBody.vue';
import CopyIcon from '@/components/svg/CopyIcon.vue';
import RevertIcon from '@/components/svg/RevertIcon.vue';
import { formatDateTime } from '@/utils/datetime';
import { renderMarkdown } from '@/utils/markdown';
import { useAlertStore } from '@/stores/alertStore';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  message: ChatUserMessage;
  revertible?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{ revert: [messageId: string] }>();

const { t } = useI18n();
const alertStore = useAlertStore();
const confirming = ref(false);

const text = computed(() => props.message.content.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n\n'));

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value);
    alertStore.addItem({ level: 'success', message: t('chat.copied') });
  } catch {
    alertStore.addItem({ level: 'error', message: t('chat.copyError') });
  }
}

function ask() {
  confirming.value = true;
}

function cancel() {
  confirming.value = false;
}

function confirm() {
  const id = props.message.id;
  confirming.value = false;
  if (id) {
    emit('revert', id);
  }
}
</script>
