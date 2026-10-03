<template>
    <div v-if="props.message.content" class="max-w-[90%] px-4 py-2">
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