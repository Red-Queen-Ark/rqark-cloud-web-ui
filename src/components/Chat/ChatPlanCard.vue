<template>
  <div v-if="items.length > 0" data-testid="chat-plan-card" class="bg-base-200 border-base-300 rounded-box mx-4 border">
    <button type="button" data-testid="chat-plan-toggle" class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
      <span class="text-sm font-semibold">{{ t('sessions.planTitle') }}</span>
      <ChevronDownIcon class="h-4 w-4 shrink-0 transition-transform" :class="{ 'rotate-180': collapsed }" />
    </button>

    <ul v-if="!collapsed" data-testid="chat-plan-body" class="border-base-300 space-y-2 border-t px-3 py-2">
      <PlanItemRow v-for="item in items" :key="item.id" :item="item" />
    </ul>

    <div data-testid="chat-plan-footer" class="text-base-content/60 border-base-300 border-t px-3 py-1.5 text-xs">
      {{ summary }}
    </div>
  </div>
</template>

<script setup lang="ts">
import PlanItemRow from '@/components/Session/PlanItem.vue';
import ChevronDownIcon from '@/components/svg/ChevronDownIcon.vue';
import type { PlanItem } from '@/config/sessions';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    items?: PlanItem[];
  }>(),
  { items: () => [] },
);

const { t } = useI18n();

const collapsed = ref(false);

const completedCount = computed(() => props.items.filter((item) => item.status === 'completed').length);
const inProgressCount = computed(() => props.items.filter((item) => item.status === 'in_progress').length);
const allCompleted = computed(() => props.items.length > 0 && completedCount.value === props.items.length);

const summary = computed(() =>
  allCompleted.value ? t('sessions.planAllCompleted', { total: props.items.length }) : t('sessions.planSummary', { total: props.items.length, completed: completedCount.value, inProgress: inProgressCount.value }),
);

// A plan the engine has finished is not worth the space: fold it away, but let
// the header and the footer say what it was. The user can still open it again.
watch(
  allCompleted,
  (value) => {
    collapsed.value = value;
  },
  { immediate: true },
);
</script>
