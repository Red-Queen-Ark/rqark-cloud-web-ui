<template>
    <template v-for="message, index in props.messages" :key="index">
        <UserMessage v-if="message.role === 'user'" :message="message.data" class="self-end" />
        <template v-else-if="message.role === 'assistant'">
            <ThinkMessage :message="message.data" />
            <AssistantMessage :message="message.data" />
            <ToolUseMessage :message="message.data" />
        </template>
        <ToolResultMessage v-else-if="message.role === 'tool'" :message="message.data" :tool-id-name-map="toolIdNameMap" />
    </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UserMessage from './message/UserMessage.vue';
import ThinkMessage from './message/ThinkMessage.vue';
import AssistantMessage from './message/AssistantMessage.vue';
import ToolUseMessage from './message/ToolUseMessage.vue';
import ToolResultMessage from './message/ToolResultMessage.vue';

const props = defineProps<{
    messages: ChatHistoryEntry[]
}>()

const toolIdNameMap = computed<Record<string, string>>(() => {
    const res: Record<string, string> = {}
    for (const msg of props.messages) {
        if (msg.role === 'assistant' && msg.data.tool_calls) {
            for (const tc of msg.data.tool_calls) {
                res[tc.id] = tc.function.name
            }
        }
    }
    return res
})
</script>