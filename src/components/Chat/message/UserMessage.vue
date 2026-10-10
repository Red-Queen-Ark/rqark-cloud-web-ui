<template>
  <div>
    <div class="rounded-xl bg-base-300 w-96 max-w-full px-4 py-2">
      <template v-for="(info, index) in props.message.content" :key="`user-${info.type}-${index}`">
        <MessageBody v-if="info.type === 'text'" :html="renderMarkdown(info.text)" :raw="info.text" />
        <div v-else-if="info.type === 'image_url'">
          <!-- info.image_url -->
        </div>
      </template>
    </div>
    <div v-if="props.revertible" class="flex justify-end p-1">
      <button type="button" data-testid="user-message-revert" class="btn btn-ghost btn-square btn-xs text-warning" :title="t('chat.revert')" :disabled="props.busy" @click="ask">
        <RevertIcon class="h-3.5 w-3.5" />
      </button>
    </div>

    <Teleport to="body">
      <FormModal v-if="confirming" :title="t('chat.revertTitle')" :description="t('chat.revertConfirm')" :confirm-label="t('chat.revert')" :cancel-label="t('chat.cancel')" confirm-class="btn-warning" @confirm="confirm" @cancel="cancel" />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import FormModal from '@/components/FormModal.vue';
import MessageBody from '@/components/Session/MessageBody.vue';
import RevertIcon from '@/components/svg/RevertIcon.vue';
import { renderMarkdown } from '@/utils/markdown';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  message: ChatUserMessage;
  revertible?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{ revert: [messageId: string] }>();

const { t } = useI18n();
const confirming = ref(false);

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
