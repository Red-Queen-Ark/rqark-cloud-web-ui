<template>
  <div class="rounded-xl bg-base-200 w-96 px-4 py-2">
    <template v-for="(info, index) in props.message.content" :key="`user-${info.type}-${index}`">
      <MessageBody v-if="info.type === 'text'" :html="renderMarkdown(info.text)" :raw="info.text" />
      <div v-else-if="info.type === 'image_url'">
        <!-- info.image_url -->
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import MessageBody from '@/components/Session/MessageBody.vue';
import { renderMarkdown } from '@/utils/markdown';

const props = defineProps<{
  message: ChatUserMessage;
}>();
</script>
