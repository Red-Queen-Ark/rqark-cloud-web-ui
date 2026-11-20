import type { ApiCreateProviderRequest, ApiProviderDto } from '@/api';

export const THINKING_VALUES = { on: 'enabled', off: 'disabled' } as const;

export const REASONING_EFFORTS = ['low', 'high', 'max'] as const;
/** Values a stored header may interpolate, mirroring the server. */
export const PROVIDER_HEADER_VARIABLES = ['session_id', 'agent_id', 'user_id', 'provider_id', 'model'] as const;

/** The variables as they are written in a header value, for a hint to list. */
export function providerHeaderVariableList(): string {
  return PROVIDER_HEADER_VARIABLES.map((name) => '${' + name + '}').join(', ');
}

/** An example line, so the placeholder shows the syntax rather than saying it. */
export const PROVIDER_HEADERS_EXAMPLE = 'x-opencode-session: ${session_id}';

export const REASONING_EFFORT_DEFAULT: (typeof REASONING_EFFORTS)[number] = 'high';

export type ProviderFieldKey = keyof ApiCreateProviderRequest;

export type ProviderFieldControl = 'text' | 'password' | 'number' | 'integer' | 'toggle' | 'select' | 'headers';

export interface ProviderFieldSpec {
  key: ProviderFieldKey;
  control: ProviderFieldControl;
  required?: boolean;
  writeOnly?: boolean;
  advanced?: boolean;
  adminOnly?: boolean;
  switchValues?: { on: string; off: string };
  choices?: readonly string[];
  defaultValue?: ProviderFieldValue;
}

export const PROVIDER_FIELDS: ProviderFieldSpec[] = [
  { key: 'name', control: 'text' },
  { key: 'model_name', control: 'text', required: true },
  { key: 'api_base', control: 'text', required: true },
  { key: 'vendor', control: 'text' },
  { key: 'api_key', control: 'password', required: true, writeOnly: true },
  { key: 'priority', control: 'integer', required: true },
  { key: 'is_public', control: 'toggle', adminOnly: true },
  { key: 'temperature', control: 'number', advanced: true },
  { key: 'top_p', control: 'number', advanced: true },
  { key: 'presence_penalty', control: 'number', advanced: true },
  { key: 'frequency_penalty', control: 'number', advanced: true },
  { key: 'seed', control: 'integer', advanced: true },
  { key: 'reasoning_effort', control: 'select', choices: REASONING_EFFORTS, defaultValue: REASONING_EFFORT_DEFAULT, advanced: true },
  { key: 'thinking', control: 'toggle', switchValues: THINKING_VALUES, advanced: true },
  { key: 'combine', control: 'toggle', advanced: true },
  { key: 'headers', control: 'headers', advanced: true },
];

export function providerFields(advanced: boolean, isSuperuser = false, creating = true): ProviderFieldSpec[] {
  return PROVIDER_FIELDS.filter((field) => (field.advanced === true) === advanced && (field.adminOnly !== true || isSuperuser)).map((field) => (creating || field.writeOnly !== true ? field : { ...field, required: false }));
}

export function providerField(key: ProviderFieldKey): ProviderFieldSpec {
  const field = PROVIDER_FIELDS.find((candidate) => candidate.key === key);
  if (!field) {
    throw new Error(`no provider field named ${key}`);
  }
  return field;
}

export type ProviderFieldValue = string | number | boolean;

export type ProviderFormValues = Record<ProviderFieldKey, ProviderFieldValue>;

export function firstMissingRequiredField(values: ProviderFormValues, fields: readonly ProviderFieldSpec[] = PROVIDER_FIELDS, creating = true): ProviderFieldSpec | undefined {
  return fields.find((field) => field.required === true && (creating || field.writeOnly !== true) && values[field.key] === '');
}

export function toProviderFormValues(provider?: ApiProviderDto): ProviderFormValues {
  const values = {} as ProviderFormValues;
  const stored = (provider ?? {}) as Record<string, unknown>;

  for (const field of PROVIDER_FIELDS) {
    const value = stored[field.key];

    if (field.control === 'headers') {
      values[field.key] = formatProviderHeaders(value as Record<string, string> | null | undefined);
      continue;
    }

    if (field.control !== 'toggle') {
      const unset = value === undefined || value === null || value === '';
      values[field.key] = unset ? (field.defaultValue ?? '') : (value as ProviderFieldValue);
      continue;
    }

    values[field.key] = field.switchValues ? value === field.switchValues.on : value === true;
  }

  return values;
}

export function toProviderRequestBody(values: ProviderFormValues, isSuperuser = false): ApiCreateProviderRequest {
  const body: Record<string, unknown> = {};

  for (const field of PROVIDER_FIELDS) {
    if (field.adminOnly === true && !isSuperuser) {
      continue;
    }

    const value = values[field.key];

    if (field.control === 'toggle') {
      body[field.key] = field.switchValues ? (value === true ? field.switchValues.on : field.switchValues.off) : value === true;
      continue;
    }

    if (field.control === 'headers') {
      body[field.key] = parseProviderHeaders(String(value ?? '')).headers;
      continue;
    }

    if (value === '') {
      continue;
    }
    body[field.key] = value;
  }

  return body as ApiCreateProviderRequest;
}

export function formatProviderHeaders(headers: Record<string, string> | null | undefined): string {
  if (!headers) {
    return '';
  }
  return Object.keys(headers)
    .sort()
    .map((name) => `${name}: ${headers[name]}`)
    .join('\n');
}

export interface ParsedProviderHeaders {
  headers: Record<string, string>;
  invalid: string[];
}

export function parseProviderHeaders(text: string): ParsedProviderHeaders {
  const headers: Record<string, string> = {};
  const invalid: string[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') {
      continue;
    }
    const separator = line.indexOf(':');
    const name = separator === -1 ? '' : line.slice(0, separator).trim();
    if (separator === -1 || name === '') {
      invalid.push(line);
      continue;
    }
    headers[name] = line.slice(separator + 1).trim();
  }

  return { headers, invalid };
}

export interface InvalidHeaderVariable {
  header: string;
  placeholder: string;
}

export function invalidProviderHeaderVariable(headers: Record<string, string>): InvalidHeaderVariable | undefined {
  const known = new Set<string>(PROVIDER_HEADER_VARIABLES);

  for (const [header, value] of Object.entries(headers)) {
    for (const match of value.matchAll(/\$\{([^}]*)\}/g)) {
      if (!known.has(match[1])) {
        return { header, placeholder: match[0] };
      }
    }
    if ((value.match(/\$\{/g) ?? []).length !== (value.match(/\$\{[^}]*\}/g) ?? []).length) {
      return { header, placeholder: '${' };
    }
  }
  return undefined;
}

export function providerDisplayName(provider: ApiProviderDto): string {
  return providerLabel(provider);
}

export function providerLabel(provider: { name?: string; model_name?: string }): string {
  return provider.name || provider.model_name || '';
}

export function providerPriority(provider: ApiProviderDto): number {
  return provider.priority ?? 0;
}

export function sortProvidersByPriority(providers: readonly ApiProviderDto[]): ApiProviderDto[] {
  return [...providers].sort((a, b) => providerPriority(a) - providerPriority(b));
}

export interface ProviderPriorityWrite {
  id: string;
  priority: number;
  owned: boolean;
}

export function providerPriorityWrite(provider: ApiProviderDto, priority: number): ProviderPriorityWrite | undefined {
  if (provider.id === undefined) {
    return undefined;
  }
  return { id: provider.id, priority, owned: provider.owned === true };
}

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
      { id: current.id, priority: providerPriority(neighbour), owned: current.owned === true },
      { id: neighbour.id, priority: providerPriority(current), owned: neighbour.owned === true },
    ];
  }

  const reordered = [...providers];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  return reordered.flatMap((provider, position) => (provider.id !== undefined && providerPriority(provider) !== position + 1 ? [{ id: provider.id, priority: position + 1, owned: provider.owned === true }] : []));
}
