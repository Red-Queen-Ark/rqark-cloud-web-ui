import type { ApiCreateProviderRequest, ApiProviderDto } from '@/api';

/**
 * The values `validateThinking` in rqark-data-cloud accepts, and the only ones
 * rqark-core understands: it maps them onto
 * `extra_body.chat_template_kwargs.enable_thinking`. The form therefore offers a
 * switch rather than free text, where anything else the user typed is a 400.
 * rqark-app's own examples pass `thinking='disabled'` explicitly, so the switch
 * writes a value instead of leaving the column unset.
 */
export const THINKING_VALUES = { on: 'enabled', off: 'disabled' } as const;

/**
 * The values `validateReasoningEffort` in rqark-data-cloud accepts. rqark-core
 * passes the value through untouched, so a typo would reach the model API.
 * `REASONING_EFFORT_DEFAULT` is what the form shows for a provider that carries
 * no value yet, so a save always writes one of the three.
 */
export const REASONING_EFFORTS = ['low', 'high', 'max'] as const;
export const REASONING_EFFORT_DEFAULT: (typeof REASONING_EFFORTS)[number] = 'high';

/**
 * The writable half of a provider. `key` is spelled exactly as the API spells
 * it, so the form, the request body and the DTO line up without a rename table;
 * the intersection drops the read-only `id`/`created_at`/`updated_at`.
 */
export type ProviderFieldKey = keyof ApiProviderDto & keyof ApiCreateProviderRequest;

/** Selects the control the form renders for a field. */
export type ProviderFieldControl = 'text' | 'password' | 'number' | 'integer' | 'toggle' | 'select';

export interface ProviderFieldSpec {
  key: ProviderFieldKey;
  control: ProviderFieldControl;
  /**
   * `validateNewProvider` in rqark-data-cloud rejects a create without it. The
   * form marks these with a red asterisk and refuses to submit while one is
   * blank, so the 400 never happens.
   */
  required?: boolean;
  /**
   * Kept behind the dialog's "Advanced options" disclosure, because a create
   * only needs the required fields. The API validates these loosely (or not at
   * all), so they are for the callers who know they want them.
   */
  advanced?: boolean;
  /**
   * A two-valued API enum rendered as a switch. The form holds a boolean for
   * such a field; `on`/`off` are the strings written to the API.
   */
  switchValues?: { on: string; off: string };
  /** The values the API accepts for the field, rendered as a select. */
  choices?: readonly string[];
  /**
   * What the control shows when the provider carries no value for the field. A
   * select with one is never blank, and the default is written on the next
   * save; without one the field reads back blank and empty stays out of the
   * request body.
   */
  defaultValue?: ProviderFieldValue;
}

/**
 * The provider form, in the order the fields are shown: the four fields
 * `validateNewProvider` insists on, then the ones a caller only reaches for on
 * purpose.
 *
 * `name` is the one exception to "optional means advanced". It is deliberately
 * not required — data-cloud defaults it to `''` and rqark-core falls back to
 * `model_name` when it reads a provider — but it is what labels the provider
 * everywhere else in the UI, so it stays up front.
 */
export const PROVIDER_FIELDS: ProviderFieldSpec[] = [
  { key: 'name', control: 'text' },
  { key: 'model_name', control: 'text', required: true },
  { key: 'api_base', control: 'text', required: true },
  { key: 'api_key', control: 'password', required: true },
  { key: 'priority', control: 'integer', required: true },
  { key: 'temperature', control: 'number', advanced: true },
  { key: 'top_p', control: 'number', advanced: true },
  { key: 'presence_penalty', control: 'number', advanced: true },
  { key: 'frequency_penalty', control: 'number', advanced: true },
  { key: 'seed', control: 'integer', advanced: true },
  { key: 'reasoning_effort', control: 'select', choices: REASONING_EFFORTS, defaultValue: REASONING_EFFORT_DEFAULT, advanced: true },
  { key: 'thinking', control: 'toggle', switchValues: THINKING_VALUES, advanced: true },
  { key: 'combine', control: 'toggle', advanced: true },
];

/**
 * The fields for one half of the dialog. `advanced` selects the ones behind the
 * disclosure; the rest are shown straight away, and together the two halves are
 * the whole form.
 */
export function providerFields(advanced: boolean): ProviderFieldSpec[] {
  return PROVIDER_FIELDS.filter((field) => (field.advanced === true) === advanced);
}

/** What a form control holds: a string, a number, or a toggle's boolean. */
export type ProviderFieldValue = string | number | boolean;

export type ProviderFormValues = Record<ProviderFieldKey, ProviderFieldValue>;

/**
 * The first field the API requires that the form left blank, or `undefined` when
 * the form can be submitted. Empty is tested against `''` rather than falsiness,
 * because a priority of `0` is a real value.
 */
export function firstMissingRequiredField(values: ProviderFormValues): ProviderFieldSpec | undefined {
  return PROVIDER_FIELDS.find((field) => field.required === true && values[field.key] === '');
}

/**
 * Builds the form values for `provider`, or a blank form when it is omitted.
 * A field the DTO does not carry reads back as '' rather than 0 or false, so
 * "not set" stays visible in the control instead of looking like a real value;
 * a field with a `defaultValue` reads back as that default instead, so a select
 * never shows blank. A switch reads back as `true` only for its `on` value,
 * which keeps the column writing 'enabled'/'disabled' rather than a boolean.
 */
export function toProviderFormValues(provider?: ApiProviderDto): ProviderFormValues {
  const values = {} as ProviderFormValues;

  for (const field of PROVIDER_FIELDS) {
    const value = provider?.[field.key];

    if (field.control !== 'toggle') {
      const unset = value === undefined || value === null || value === '';
      values[field.key] = unset ? (field.defaultValue ?? '') : (value as ProviderFieldValue);
      continue;
    }

    values[field.key] = field.switchValues ? value === field.switchValues.on : value === true;
  }

  return values;
}

/**
 * Turns the form into a request body. An empty control is left out: the API
 * rejects '' for the numeric fields, and on update an absent field keeps its
 * stored value, which is the closest thing the API offers to "not set".
 *
 * Two kinds of control are the exception, because neither can be empty: the
 * switches (`combine` is a boolean column, and `thinking` must carry one of its
 * two spellings to have any effect at all) and a select with a `defaultValue`,
 * which reads back as that default. Both are written on every save.
 */
export function toProviderRequestBody(values: ProviderFormValues): ApiCreateProviderRequest {
  const body: Record<string, unknown> = {};

  for (const field of PROVIDER_FIELDS) {
    const value = values[field.key];

    if (field.control === 'toggle') {
      body[field.key] = field.switchValues ? (value === true ? field.switchValues.on : field.switchValues.off) : value === true;
      continue;
    }

    if (value === '') {
      continue;
    }
    body[field.key] = value;
  }

  return body as ApiCreateProviderRequest;
}

/**
 * The label to show for a provider. `name` is optional — data-cloud stores `''`
 * — and rqark-core falls back to `model_name` when it reads one, so the list
 * does the same instead of showing a blank cell.
 */
export function providerDisplayName(provider: ApiProviderDto): string {
  return providerLabel(provider);
}

/** The same label, for the summary listing that carries only the two columns. */
export function providerLabel(provider: { name?: string; model_name?: string }): string {
  return provider.name || provider.model_name || '';
}

/** The `priority` a provider carries; a provider without one sorts as `0`. */
export function providerPriority(provider: ApiProviderDto): number {
  return provider.priority ?? 0;
}

/**
 * The providers in the order the API serves them: lowest priority first, ties
 * left in the order they arrived. The list is re-sorted here rather than trusted
 * as-is, so the up/down controls and the rows they act on cannot disagree.
 */
export function sortProvidersByPriority(providers: readonly ApiProviderDto[]): ApiProviderDto[] {
  return [...providers].sort((a, b) => providerPriority(a) - providerPriority(b));
}

/** One provider whose `priority` has to be written back, and the value to write. */
export interface ProviderPriorityWrite {
  id: string;
  priority: number;
}

/**
 * The writes that trade `providers[index]`'s place with the row `direction` steps
 * away (−1 up, +1 down). Empty when the row is already at that end, or when
 * either row has no id to address.
 *
 * Two rows normally just swap their `priority`, which keeps the numbers the
 * caller chose and touches only two rows. Priorities need not be unique, though,
 * and swapping equal values would move nothing, so in that case every row is
 * renumbered `1..n` in the new order instead.
 */
export function providerPriorityWrites(providers: readonly ApiProviderDto[], index: number, direction: -1 | 1): ProviderPriorityWrite[] {
  const target = index + direction;

  if (index < 0 || index >= providers.length || target < 0 || target >= providers.length) {
    return [];
  }

  const current = providers[index];
  const neighbour = providers[target];

  if (!current.id || !neighbour.id) {
    return [];
  }

  if (providerPriority(current) !== providerPriority(neighbour)) {
    return [
      { id: current.id, priority: providerPriority(neighbour) },
      { id: neighbour.id, priority: providerPriority(current) },
    ];
  }

  const reordered = [...providers];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  return reordered.flatMap((provider, position) => (provider.id !== undefined && providerPriority(provider) !== position + 1 ? [{ id: provider.id, priority: position + 1 }] : []));
}
