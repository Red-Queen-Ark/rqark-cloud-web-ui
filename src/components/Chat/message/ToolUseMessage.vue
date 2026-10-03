<template>
    <div v-if="props.message.tool_calls" class="w-full px-4 py-3">
        <div v-for="tool_call in props.message.tool_calls" :key="tool_call.id">
            use {{ tool_call.function.name }}
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    message: ChatAssistantMessage
}>()
</script>