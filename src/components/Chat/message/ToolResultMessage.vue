<template>
    <div class="w-full px-4 py-3">
        <div class="collapse collapse-arrow">
            <input type="checkbox" />
            <div class="collapse-title after:inset-s-1 after:inset-e-auto pe-1 ps-8 p-0">tool result {{ props.message.tool_call_id }}</div>
            <div class="collapse-content text-sm">
                {{ props.message.content }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    message: ChatToolMessage
}>()
</script>