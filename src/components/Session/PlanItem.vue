<template>
  <li data-testid="plan-item" class="flex items-start gap-2">
    <component :is="statusStyle.icon" v-if="statusStyle.icon" data-testid="plan-item-icon" class="mt-0.5 h-3.5 w-3.5 shrink-0" :class="statusStyle.iconClass" />
    <span v-else data-testid="plan-item-raw-status" class="text-base-content/50 mt-0.5 shrink-0 font-mono text-xs">{{ item.status }}</span>
    <span class="min-w-0 text-sm break-words" :class="{ 'line-through opacity-60': completed, 'opacity-60': cancelled }">{{ item.content }}</span>
    <span v-if="statusLabel" class="sr-only">{{ statusLabel }}</span>
  </li>
</template>

<script setup lang="ts">
import { planStatusStyle, type PlanItem } from '@/config/sessions';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  item: PlanItem;
}>();

const { t } = useI18n();

const statusStyle = computed(() => planStatusStyle(props.item.status));
const statusLabel = computed(() => (statusStyle.value.labelKey ? t(statusStyle.value.labelKey) : ''));
const completed = computed(() => props.item.status === 'completed');
const cancelled = computed(() => props.item.status === 'cancelled');
</script>
