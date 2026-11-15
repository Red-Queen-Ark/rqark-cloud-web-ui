<template>
  <fieldset :id="idPrefix" class="fieldset min-w-0">
    <legend class="fieldset-legend">{{ label }}</legend>

    <ul class="space-y-1">
      <li v-for="row in rows" :key="row.name">
        <label class="flex items-center gap-2" :class="readonly ? 'cursor-default' : 'cursor-pointer'">
          <input :id="`${idPrefix}-${row.name}`" data-testid="agent-component-toggle" type="checkbox" class="checkbox checkbox-sm" :checked="row.checked" :disabled="readonly" @change="toggle(row.name, $event)" />
          <span class="font-medium">{{ row.name }}</span>
          <span v-if="!row.spec" class="badge badge-ghost badge-xs">{{ t('agents.unknownComponent') }}</span>
        </label>

        <template v-if="row.checked">
          <!-- Known entry with plain params: one labelled input per parameter. -->
          <div v-if="row.spec && row.spec.params.length > 0" class="mt-2 ml-6 space-y-2">
            <label v-for="param in row.spec.params" :key="param.key" class="fieldset">
              <span class="fieldset-legend">{{ param.key }}</span>
              <textarea
                v-if="param.multiline"
                :id="`${idPrefix}-${row.name}-${param.key}`"
                :value="paramValue(row.name, param.key)"
                class="textarea w-full"
                rows="3"
                :disabled="readonly"
                @input="setParam(row.name, param.key, $event)"
              ></textarea>
              <input
                v-else
                :id="`${idPrefix}-${row.name}-${param.key}`"
                :type="param.secret ? 'password' : 'text'"
                class="input w-full"
                :value="paramValue(row.name, param.key)"
                :disabled="readonly"
                @input="setParam(row.name, param.key, $event)"
              />
            </label>
          </div>

          <!-- A nested entry holds further lists, so it recurses instead. -->
          <div v-else-if="row.spec?.nested" class="border-base-300 mt-2 ml-6 space-y-3 border-l pl-4">
            <AgentComponentPicker
              :model-value="nestedRefs(row.name, 'prompts')"
              kind="prompts"
              :label="t('agents.nestedPrompts')"
              :id-prefix="`${idPrefix}-${row.name}-prompts`"
              :readonly="readonly"
              @update:model-value="updateNested(row.name, 'prompts', $event)"
            />
            <AgentComponentPicker
              :model-value="nestedRefs(row.name, 'tools')"
              kind="tools"
              :label="t('agents.nestedTools')"
              :id-prefix="`${idPrefix}-${row.name}-tools`"
              :readonly="readonly"
              @update:model-value="updateNested(row.name, 'tools', $event)"
            />
          </div>

          <!-- Unknown entry: keep the params opaque so a newer engine's config survives. -->
          <pre v-else-if="row.spec === undefined && row.params" data-testid="agent-component-raw-params" class="bg-base-200 mt-2 ml-6 overflow-x-auto rounded p-2 text-xs">{{ JSON.stringify(row.params, null, 2) }}</pre>
        </template>
      </li>
    </ul>
  </fieldset>
</template>

<script setup lang="ts">
import type { AgentComponentKind, AgentComponentRef, AgentComponentSpec } from '@/config/agents';
import { agentCatalogue, createAgentComponentRef, findAgentComponent } from '@/config/agents';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    modelValue: AgentComponentRef[];
    kind: AgentComponentKind;
    label: string;
    /** Namespaces the control ids so nested pickers stay unique on the page. */
    idPrefix: string;
    readonly?: boolean;
  }>(),
  { readonly: false },
);

const emit = defineEmits<{
  'update:model-value': [value: AgentComponentRef[]];
}>();

const { t } = useI18n();

interface Row {
  name: string;
  spec?: AgentComponentSpec;
  params?: Record<string, unknown>;
  checked: boolean;
}

/**
 * Every catalogue entry, ticked or not, followed by any entry the config names
 * that this build does not know, so nothing is hidden from the user.
 */
const rows = computed<Row[]>(() => {
  const present = new Map(props.modelValue.map((ref) => [ref.name, ref]));
  const catalogue = agentCatalogue(props.kind);

  const known: Row[] = catalogue.map((spec) => ({
    name: spec.name,
    spec,
    checked: present.has(spec.name),
  }));

  const unknown: Row[] = props.modelValue.filter((ref) => !catalogue.some((spec) => spec.name === ref.name)).map((ref) => ({ name: ref.name, params: ref.params, checked: true }));

  return [...known, ...unknown];
});

function toggle(name: string, event: Event) {
  if ((event.target as HTMLInputElement).checked) {
    const spec = findAgentComponent(props.kind, name);
    emit('update:model-value', [...props.modelValue, spec ? createAgentComponentRef(spec) : { name }]);
    return;
  }
  emit(
    'update:model-value',
    props.modelValue.filter((ref) => ref.name !== name),
  );
}

function paramValue(name: string, key: string): string {
  const value = props.modelValue.find((ref) => ref.name === name)?.params?.[key];
  if (value === undefined || value === null) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
}

function setParam(name: string, key: string, event: Event) {
  const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  emit(
    'update:model-value',
    props.modelValue.map((ref) => (ref.name === name ? { name: ref.name, params: { ...(ref.params ?? {}), [key]: value } } : ref)),
  );
}

function nestedRefs(name: string, kind: AgentComponentKind): AgentComponentRef[] {
  const value = props.modelValue.find((ref) => ref.name === name)?.params?.[kind];
  return Array.isArray(value) ? (value as AgentComponentRef[]) : [];
}

function updateNested(name: string, kind: AgentComponentKind, value: AgentComponentRef[]) {
  emit(
    'update:model-value',
    props.modelValue.map((ref) => (ref.name === name ? { name: ref.name, params: { ...(ref.params ?? {}), [kind]: value } } : ref)),
  );
}
</script>
