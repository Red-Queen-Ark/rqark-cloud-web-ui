<template>
  <FormModal :title="title" :confirm-label="confirmLabel" :cancel-label="t('workspace.cancel')" :saving="saving" :description="description" @confirm="submit" @cancel="emit('cancel')">
    <label class="form-control w-full">
      <span class="label-text pb-1">{{ label }}</span>
      <input ref="input" v-model="value" data-testid="workspace-item-name" type="text" class="input input-bordered w-full" :placeholder="placeholder" @keydown.enter.prevent="submit" />
    </label>
    <p v-if="error" data-testid="workspace-item-error" class="text-error text-sm">{{ error }}</p>
  </FormModal>
</template>

<script setup lang="ts">
import FormModal from '@/components/FormModal.vue';
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    title: string;
    label: string;
    placeholder?: string;
    confirmLabel: string;
    description?: string;
    initial?: string;
    saving?: boolean;
    allowSlash?: boolean;
  }>(),
  { placeholder: '', description: '', initial: '', saving: false, allowSlash: false },
);

const emit = defineEmits<{ confirm: [value: string]; cancel: [] }>();

const { t } = useI18n();
const input = ref<HTMLInputElement | null>(null);
const value = ref(props.initial);
const dirty = ref(false);

const error = computed(() => {
  const trimmed = value.value.trim();
  if (!dirty.value) {
    return '';
  }
  if (!trimmed) {
    return t('workspace.nameRequired');
  }
  if (!props.allowSlash && trimmed.includes('/')) {
    return t('workspace.nameNoSlash');
  }
  if (trimmed.split('/').some((segment) => segment === '..')) {
    return t('workspace.nameInvalid');
  }
  return '';
});

function submit() {
  dirty.value = true;
  const trimmed = value.value.trim();
  if (error.value || !trimmed) {
    return;
  }
  emit('confirm', trimmed);
}

onMounted(async () => {
  await nextTick();
  input.value?.focus();
  input.value?.select();
});
</script>
