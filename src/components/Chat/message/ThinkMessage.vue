<template>
  <div v-if="props.message.reasoning_content" class="w-full">
    <div class="collapse collapse-arrow">
      <input type="checkbox" />
      <div class="collapse-title after:inset-s-1 after:inset-e-auto pe-1 ps-8 p-0">think</div>
      <div class="collapse-content text-sm text-base-content/50">
        {{ props.message.reasoning_content }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  message: ChatAssistantMessage;
}>();
</script>
