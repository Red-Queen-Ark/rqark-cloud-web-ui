<template>
  <label class="fieldset min-w-0">
    <span class="fieldset-legend">
      {{ label }}
      <!-- Only the fields the API refuses to create a provider without. -->
      <span v-if="field.required" class="text-error" aria-hidden="true">*</span>
    </span>

    <input v-if="field.control === 'toggle'" :id="controlId" v-model="model" type="checkbox" class="toggle" :required="field.required === true" @keyup.enter="emit('submit')" />

    <!-- No empty option: the choices are exactly the values the API accepts. A
         field the provider does not carry reads back as the field's default
         (see `toProviderFormValues`) and is written on the next save. -->
    <select v-else-if="field.control === 'select'" :id="controlId" v-model="model" class="select w-full" :required="field.required === true" @keyup.enter="emit('submit')">
      <option v-for="choice in field.choices" :key="choice" :value="choice">{{ choice }}</option>
    </select>

    <input
      v-else-if="field.control === 'number' || field.control === 'integer'"
      :id="controlId"
      :value="model"
      type="number"
      class="input w-full"
      :step="field.control === 'integer' ? 1 : 'any'"
      :required="field.required === true"
      @input="onNumberInput"
      @keyup.enter="emit('submit')"
    />
    <input v-else :id="controlId" v-model="model" :type="field.control" class="input w-full" :required="field.required === true" :autocomplete="field.control === 'password' ? 'new-password' : 'off'" @keyup.enter="emit('submit')" />
    <span v-if="hint" class="text-base-content/60 text-xs">{{ hint }}</span>
  </label>
</template>

<script setup lang="ts">
import type { ProviderFieldSpec, ProviderFieldValue } from '@/config/providers';
import { computed } from 'vue';

const props = defineProps<{ field: ProviderFieldSpec; label: string; hint?: string }>();

/** The form value for the field; the parent owns the object it lives in. */
const model = defineModel<ProviderFieldValue>({ required: true });

const emit = defineEmits<{ submit: [] }>();

const controlId = computed(() => `provider-${props.field.key}`);

function onNumberInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  // An emptied number input reads back as '', and that has to survive as "not
  // set" instead of turning into a 0 the caller never asked for.
  model.value = raw === '' ? '' : Number(raw);
}
</script>
