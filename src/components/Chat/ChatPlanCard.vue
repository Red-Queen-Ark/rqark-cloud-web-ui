<template>
  <div v-if="items.length > 0" data-testid="chat-plan-card" class="bg-base-200 border-base-300 rounded-box mx-4 border">
    <button
      type="button"
      data-testid="chat-plan-toggle"
      class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      :aria-expanded="!collapsed"
      :aria-controls="bodyId"
      @click="collapsed = !collapsed"
    >
      <span class="text-sm font-semibold">{{ t('sessions.planTitle') }}</span>
      <ChevronDownIcon class="h-4 w-4 shrink-0 transition-transform" :class="{ 'rotate-180': collapsed }" />
    </button>

    <ul v-if="!collapsed" :id="bodyId" data-testid="chat-plan-body" class="border-base-300 space-y-2 border-t px-3 py-2">
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
import { computed, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    items?: PlanItem[];
  }>(),
  { items: () => [] },
);

const { t } = useI18n();

const collapsed = ref(false);
const bodyId = useId();

/** The item the engine is working on; empty when it is working on none. */
const activeIds = computed(() =>
  props.items
    .filter((item) => item.status === 'in_progress')
    .map((item) => item.id)
    .join(','),
);

const counts = computed(() => {
  const byStatus: Record<string, number> = { completed: 0, in_progress: 0, pending: 0, cancelled: 0 };

  for (const item of props.items) {
    // A status this build does not know is left out of the tally rather than
    // guessed at: the rows still show it, the footer only counts what it knows.
    if (item.status in byStatus) {
      byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    }
  }

  return byStatus;
});

const allCompleted = computed(() => props.items.length > 0 && counts.value.completed === props.items.length);

const SUMMARY_KEYS = [
  ['completed', 'sessions.planCountCompleted'],
  ['in_progress', 'sessions.planCountInProgress'],
  ['pending', 'sessions.planCountPending'],
  ['cancelled', 'sessions.planCountCancelled'],
] as const;

const summary = computed(() => {
  if (allCompleted.value) {
    return t('sessions.planAllCompleted', { total: props.items.length });
  }

  // Every state that has a count gets a word, so a cancelled or parked item is
  // never silently dropped from the total.
  const parts = [t('sessions.planTotal', { total: props.items.length })];

  for (const [status, key] of SUMMARY_KEYS) {
    const count = counts.value[status] ?? 0;
    if (count > 0) {
      parts.push(t(key, { count }));
    }
  }

  return parts.join(' · ');
});

// A finished plan is not worth the space: fold it away, but let the header and
// the footer say what it was. The user can still open it again.
watch(
  allCompleted,
  (value) => {
    collapsed.value = value;
  },
  { immediate: true },
);

// A fold the user made while the plan was done would otherwise hide the next
// plan too, since a plan arriving from done to active does not change
// `allCompleted`. Any new item in flight opens the card again.
watch(activeIds, (ids) => {
  if (ids !== '') {
    collapsed.value = false;
  }
});
</script>
