<template>
  <li data-testid="plan-item" class="flex items-start gap-2">
    <span v-if="item.status === 'in_progress'" class="loading loading-spinner loading-xs text-info shrink-0"></span>
    <span class="badge badge-xs shrink-0" :class="statusStyle.badgeClass">{{ statusLabel }}</span>
    <span class="min-w-0 text-sm break-words" :class="{ 'line-through opacity-60': completed }">{{ item.content }}</span>
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
const statusLabel = computed(() => (statusStyle.value.labelKey ? t(statusStyle.value.labelKey) : props.item.status));
const completed = computed(() => props.item.status === 'completed');
</script>
