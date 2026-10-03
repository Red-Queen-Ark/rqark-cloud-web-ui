<template>
    <template v-for="message, index in props.messages" :key="index">
        <UserMessage v-if="message.role === 'user'" :message="message.data" class="self-end" />
        <template v-else-if="message.role === 'assistant'">
            <ThinkMessage :message="message.data" />
            <AssistantMessage :message="message.data" />
            <ToolUseMessage :message="message.data" />
        </template>
        <ToolResultMessage v-else-if="message.role === 'tool'" :message="message.data" />
    </template>
</template>

<script setup lang="ts">
import UserMessage from './message/UserMessage.vue';
import ThinkMessage from './message/ThinkMessage.vue';
import AssistantMessage from './message/AssistantMessage.vue';
import ToolUseMessage from './message/ToolUseMessage.vue';
import ToolResultMessage from './message/ToolResultMessage.vue';

const props = defineProps<{
    messages: ChatHistoryEntry[]
}>()
</script>