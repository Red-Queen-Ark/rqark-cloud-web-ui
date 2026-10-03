<template>
    <div class="rounded-xl bg-base-200 w-96 px-4 py-3">
        <template v-for="info, index in props.message.content" :key="`user-${info.type}-${index}`">
            <div v-if="info.type === 'text'">
                {{ info.text }}
            </div>
            <div v-else-if="info.type === 'image_url'">
                <!-- info.image_url -->
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    message: ChatUserMessage
}>()
</script>
