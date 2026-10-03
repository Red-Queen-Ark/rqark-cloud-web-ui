<template>
    <div v-if="props.message.tool_calls" class="w-full">
        <div v-for="tool_call in props.message.tool_calls" :key="tool_call.id" class="px-4 py-2">
            <div class="collapse">
                <input type="checkbox" />
                <div class="collapse-title after:inset-s-1 after:inset-e-auto p-0">
                    <span class="m-0.5 me-2 inline-flex items-center align-middle"
                        :data-testid="`tool-status-${tool_call.id}`">
                        <span v-if="!props.toolResult[tool_call.id]"
                            class="loading loading-spinner loading-xs text-warning"></span>
                        <AlertIcon v-else-if="isError(tool_call.id)" level="error" class="h-4 w-4 text-error" />
                        <CheckIcon v-else class="h-4 w-4 text-success" />
                    </span>
                    <span>{{ tool_call.function.name }}</span>
                    <!-- {{ tool_call.function.arguments }} -->
                </div>
                <div class="collapse-content text-sm text-base-content/60">
                    {{ props.toolResult[tool_call.id]?.content }}
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import AlertIcon from '@/components/svg/AlertIcon.vue';
import CheckIcon from '@/components/svg/CheckIcon.vue';

const TOOL_ERROR_PREFIX = 'Error:';

const props = defineProps<{
    message: ChatAssistantMessage;
    toolResult: Record<string, ChatToolMessage>;
}>();

function isError(toolCallId: string): boolean {
    return props.toolResult[toolCallId]?.content.startsWith(TOOL_ERROR_PREFIX) ?? false;
}
</script>
