<template>
    <div v-if="props.message.tool_calls" class="w-full">
        <div v-for="tool_call in props.message.tool_calls" :key="tool_call.id" class="px-4 py-2">
            <div class="collapse collapse-arrow">
            <input type="checkbox" />
            <div class="collapse-title after:inset-s-1 after:inset-e-auto pe-1 ps-8 p-0">
                <span></span>
                <span>{{ tool_call.function.name }}</span>
                <!-- {{ tool_call.function.arguments }} -->
            </div>
            <div class="collapse-content text-sm text-base-content/60">
                {{ props.toolResult[tool_call.id].content }}
            </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  message: ChatAssistantMessage;
  toolResult: Record<string, ChatToolMessage>;
}>();
</script>
