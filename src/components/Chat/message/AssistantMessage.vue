<template>
    <div v-if="props.message.content" class="w-full px-4 py-3">
        <div v-if="props.message.content">
            {{ props.message.content }}
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    message: ChatAssistantMessage
}>()
</script>