<template>
  <div v-if="props.message.tool_calls" class="w-full">
    <div v-for="tool_call in props.message.tool_calls" :key="tool_call.id" class="px-4 py-2">use {{ tool_call.function.name }}</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  message: ChatAssistantMessage;
}>();
</script>
