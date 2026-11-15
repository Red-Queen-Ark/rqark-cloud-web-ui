<template>
  <div data-testid="form-modal" class="modal modal-open">
    <div data-testid="form-modal-box" class="modal-box" :class="[{ 'max-w-2xl': wide }, boxClass]">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-lg font-bold">{{ title }}</h3>
          <p v-if="description" class="text-base-content/60 pt-1 text-sm">{{ description }}</p>
        </div>
        <slot name="header-actions"></slot>
      </div>

      <div class="space-y-3 py-4">
        <slot></slot>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button v-if="!readonly" class="btn" :class="confirmClass" :disabled="saving" @click="emit('confirm')">
          <span v-if="saving" class="loading loading-spinner loading-sm"></span>
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel: string;
    /** Styles the confirm action, e.g. btn-error for a destructive dialog. */
    confirmClass?: string;
    saving?: boolean;
    wide?: boolean;
    /**
     * Extra width utilities for the box, for the dialogs that lay their fields
     * out in columns and would be cramped at the default width.
     */
    boxClass?: string;
    readonly?: boolean;
  }>(),
  { description: '', confirmLabel: '', confirmClass: 'btn-primary', saving: false, wide: false, boxClass: '', readonly: false },
);

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();
</script>
