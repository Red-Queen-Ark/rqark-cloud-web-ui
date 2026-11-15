<template>
  <div data-testid="data-list-panel" class="bg-base-200/60 border-base-300 rounded-box border">
    <div class="p-2 sm:p-4">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <span class="loading loading-spinner loading-md text-primary" :aria-label="loadingLabel"></span>
      </div>

      <div v-else-if="empty" class="flex flex-col items-center justify-center py-20 text-center">
        <img src="/logo.svg" alt="" class="mb-4 h-24 w-24 opacity-50" />
        <p class="mb-1 text-xl font-bold">{{ emptyTitle }}</p>
        <p class="text-base-content/70 mb-4 max-w-sm text-sm">{{ emptyDescription }}</p>
        <button v-if="emptyActionLabel" :id="emptyActionId" class="btn btn-primary btn-sm" @click="emit('create')">{{ emptyActionLabel }}</button>
      </div>

      <slot v-else></slot>

      <div v-if="paginated" class="flex items-center justify-between px-2 pt-3">
        <span class="text-base-content/70 text-xs">{{ pageInfo }}</span>
        <div class="join">
          <button class="btn btn-sm join-item" :disabled="start === 0" @click="emit('prev')">{{ previousLabel }}</button>
          <button class="btn btn-sm join-item" :disabled="start + size >= count" @click="emit('next')">{{ nextLabel }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  loading: boolean;
  loadingLabel: string;
  empty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  emptyActionId?: string;
  total?: number;
  limit?: number;
  offset?: number;
  pageInfo?: string;
  previousLabel?: string;
  nextLabel?: string;
}>();

const emit = defineEmits<{
  create: [];
  prev: [];
  next: [];
}>();

const start = computed(() => props.offset ?? 0);
const size = computed(() => props.limit ?? 0);
const count = computed(() => props.total ?? 0);

const paginated = computed(() => props.total !== undefined && props.limit !== undefined && count.value > size.value);
</script>
