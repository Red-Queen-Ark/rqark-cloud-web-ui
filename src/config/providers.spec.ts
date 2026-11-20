import { describe, expect, it } from 'vitest';
import {
  PROVIDER_FIELDS,
  firstMissingRequiredField,
  providerDisplayName,
  providerField,
  PROVIDER_HEADERS_EXAMPLE,
  invalidProviderHeaderVariable,
  parseProviderHeaders,
  providerFields,
  providerHeaderVariableList,
  providerPriorityWrite,
  providerPriorityWrites,
  sortProvidersByPriority,
  toProviderFormValues,
  toProviderRequestBody,
} from './providers';

describe('provider form', () => {
  it('marks exactly the fields validateNewProvider requires', () => {
    expect(PROVIDER_FIELDS.filter((field) => field.required).map((field) => field.key)).toEqual(['model_name', 'api_base', 'api_key', 'priority']);
  });

  it('shows the required fields up front and hides the rest behind the disclosure', () => {
    expect(providerFields(false, true).map((field) => field.key)).toEqual(['name', 'model_name', 'api_base', 'vendor', 'api_key', 'priority', 'is_public']);
    expect(providerFields(true, true).map((field) => field.key)).toEqual(['temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'seed', 'reasoning_effort', 'thinking', 'combine', 'headers']);
    expect([...providerFields(false, true), ...providerFields(true, true)]).toEqual(PROVIDER_FIELDS);
    expect(providerFields(true, true).every((field) => field.required !== true)).toBe(true);
    expect(
      providerFields(false, true)
        .filter((field) => field.required !== true)
        .map((field) => field.key),
    ).toEqual(['name', 'vendor', 'is_public']);
  });

  it('drops the admin-only fields from a non-superuser form', () => {
    expect(providerFields(false).map((field) => field.key)).toEqual(['name', 'model_name', 'api_base', 'vendor', 'api_key', 'priority']);
    expect(providerFields(true).map((field) => field.key)).toEqual(['temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'seed', 'reasoning_effort', 'thinking', 'combine', 'headers']);
    expect(providerFields(false, false).every((field) => field.adminOnly !== true)).toBe(true);
  });

  it('reads a provider back into controls, including the switches', () => {
    const values = toProviderFormValues({
      id: 'provider-1',
      name: 'primary',
      model_name: 'deepseek-v4-pro',
      api_base: 'https://api.deepseek.com/v1',
      priority: 1,
      temperature: 0.7,
      reasoning_effort: 'low',
      thinking: 'enabled',
      combine: true,
    });

    expect(values.temperature).toBe(0.7);
    expect(values.reasoning_effort).toBe('low');
    expect(values.thinking).toBe(true);
    expect(values.combine).toBe(true);
    expect(values.api_key).toBe('');
  });

  it('leaves the values a provider does not carry blank, save for the defaulted select', () => {
    const values = toProviderFormValues({ id: 'provider-1', model_name: 'kimi-k3' });

    expect(values.temperature).toBe('');
    expect(values.reasoning_effort).toBe('high');
    expect(values.thinking).toBe(false);
    expect(values.combine).toBe(false);
  });

  it('writes the thinking switch as one of the two values the API accepts', () => {
    const off = toProviderRequestBody(toProviderFormValues({ model_name: 'kimi-k3' }));
    expect(off.thinking).toBe('disabled');

    const on = toProviderRequestBody(toProviderFormValues({ model_name: 'kimi-k3', thinking: 'enabled' }));
    expect(on.thinking).toBe('enabled');
  });

  it('reads the public flag back as a switch', () => {
    expect(toProviderFormValues({ model_name: 'kimi-k3', is_public: true }).is_public).toBe(true);
    expect(toProviderFormValues({ model_name: 'kimi-k3' }).is_public).toBe(false);
  });

  it('only sends the public flag for a superuser', () => {
    const shared = toProviderFormValues({ model_name: 'kimi-k3', api_base: 'https://api.moonshot.cn/v1', priority: 1, is_public: true });
    shared.api_key = 'sk-x';
    expect(toProviderRequestBody(shared, true).is_public).toBe(true);
    expect(toProviderRequestBody(shared, false).is_public).toBeUndefined();
  });

  it('omits empty parameters but keeps the required ones, the switches and the defaulted select', () => {
    const form = toProviderFormValues({ model_name: 'kimi-k3', api_base: 'https://api.moonshot.cn/v1', priority: 2 });
    form.api_key = 'sk-x';
    const body = toProviderRequestBody(form);

    expect(body).toEqual({
      model_name: 'kimi-k3',
      api_base: 'https://api.moonshot.cn/v1',
      api_key: 'sk-x',
      priority: 2,
      reasoning_effort: 'high',
      thinking: 'disabled',
      combine: false,
      headers: {},
    });
  });

  it('treats a blank required field as missing, but not a priority of zero', () => {
    const blank = toProviderFormValues();
    expect(firstMissingRequiredField(blank)?.key).toBe('model_name');

    const zero = toProviderFormValues({ model_name: 'kimi-k3', api_base: 'https://api.moonshot.cn/v1', priority: 0 });
    expect(firstMissingRequiredField(zero)?.key).toBe('api_key');
    zero.api_key = 'sk-x';
    expect(firstMissingRequiredField(zero)).toBeUndefined();
    expect(firstMissingRequiredField(zero, PROVIDER_FIELDS, false)).toBeUndefined();
  });

  it('stops requiring the write-only key once the dialog edits a provider', () => {
    const editing = toProviderFormValues({ model_name: 'kimi-k3', api_base: 'https://api.moonshot.cn/v1', priority: 1 });

    const key = providerFields(false, false, false).find((field) => field.key === 'api_key');
    expect(key?.writeOnly).toBe(true);
    expect(key?.required).not.toBe(true);
    expect(providerFields(false, false, true).find((field) => field.key === 'api_key')?.required).toBe(true);
    expect(toProviderRequestBody(editing, false).api_key).toBeUndefined();
  });

  it('reads the vendor label back and writes it unchanged', () => {
    expect(toProviderFormValues({ model_name: 'kimi-k3', vendor: 'moonshot' }).vendor).toBe('moonshot');
    expect(toProviderFormValues({ model_name: 'kimi-k3' }).vendor).toBe('');

    const form = toProviderFormValues({ model_name: 'kimi-k3', api_base: 'https://api.moonshot.cn/v1', priority: 1 });
    form.vendor = 'moonshot';
    expect(toProviderRequestBody(form, false).vendor).toBe('moonshot');
  });

  it('edits headers as one Name: value per line', () => {
    const values = toProviderFormValues({
      model_name: 'kimi-k3',
      headers: { 'X-Api-Version': '2024-06-01', 'X-Trace': 'on' },
    });

    expect(values.headers).toBe('X-Api-Version: 2024-06-01\nX-Trace: on');
    expect(toProviderRequestBody(values, false).headers).toEqual({ 'X-Api-Version': '2024-06-01', 'X-Trace': 'on' });
  });

  it('keeps a header value that carries a colon', () => {
    expect(parseProviderHeaders('Referer: https://example.invalid/a:b').headers).toEqual({ Referer: 'https://example.invalid/a:b' });
  });

  it('reports a header line that is not Name: value', () => {
    const parsed = parseProviderHeaders('X-Ok: 1\nnot a header\n: blank name');
    expect(parsed.headers).toEqual({ 'X-Ok': '1' });
    expect(parsed.invalid).toEqual(['not a header', ': blank name']);
  });

  it('sends an empty header object so a cleared set is cleared, and nothing else', () => {
    const form = toProviderFormValues({ model_name: 'kimi-k3', api_base: 'https://api.moonshot.cn/v1', priority: 1 });
    form.api_key = 'sk-x';
    form.headers = '';

    expect(toProviderRequestBody(form, false).headers).toEqual({});
  });

  it('lists the values a header may interpolate', () => {
    expect(providerHeaderVariableList()).toBe('${session_id}, ${agent_id}, ${user_id}, ${provider_id}, ${model}');
    expect(PROVIDER_HEADERS_EXAMPLE).toBe('x-opencode-session: ${session_id}');
  });

  it('accepts a header value built from the known variables', () => {
    expect(invalidProviderHeaderVariable({ 'x-opencode-session': '${session_id}' })).toBeUndefined();
    expect(invalidProviderHeaderVariable({ 'X-Trace': 'rqark/${provider_id}/${model}' })).toBeUndefined();
    expect(invalidProviderHeaderVariable({ 'X-Api-Version': '2024-06-01' })).toBeUndefined();
  });

  it('reports a placeholder the proxy cannot fill, and one left open', () => {
    expect(invalidProviderHeaderVariable({ 'x-opencode-session': '${nope}' })).toEqual({ header: 'x-opencode-session', placeholder: '${nope}' });
    expect(invalidProviderHeaderVariable({ 'x-opencode-session': '${session_id' })).toEqual({ header: 'x-opencode-session', placeholder: '${' });
  });

  it('falls back to model_name when a provider has no name', () => {
    expect(providerDisplayName({ name: '', model_name: 'kimi-k3' })).toBe('kimi-k3');
    expect(providerDisplayName({ name: 'primary', model_name: 'kimi-k3' })).toBe('primary');
  });
});

describe('provider priority order', () => {
  const first = { id: 'provider-1', name: 'first', priority: 1, owned: true };
  const second = { id: 'provider-2', name: 'second', priority: 2, owned: true };
  const third = { id: 'provider-3', name: 'third', priority: 3, owned: true };

  it('sorts lowest priority first and treats a missing one as zero', () => {
    const order = sortProvidersByPriority([third, first, { id: 'provider-0', name: 'unset' }, second]);
    expect(order.map((provider) => provider.id)).toEqual(['provider-0', 'provider-1', 'provider-2', 'provider-3']);
  });

  it('swaps the two priorities when a row trades places with its neighbour', () => {
    expect(providerPriorityWrites([first, second, third], 2, -1)).toEqual([
      { id: 'provider-3', priority: 2, owned: true },
      { id: 'provider-2', priority: 3, owned: true },
    ]);
    expect(providerPriorityWrites([first, second, third], 0, 1)).toEqual([
      { id: 'provider-1', priority: 2, owned: true },
      { id: 'provider-2', priority: 1, owned: true },
    ]);
  });

  it('has nothing to write at either end of the list', () => {
    expect(providerPriorityWrites([first, second, third], 0, -1)).toEqual([]);
    expect(providerPriorityWrites([first, second, third], 2, 1)).toEqual([]);
  });

  it('renumbers when the neighbours share a priority, so the move still happens', () => {
    const tied = [
      { id: 'provider-1', name: 'first', priority: 1, owned: true },
      { id: 'provider-2', name: 'second', priority: 1, owned: true },
      { id: 'provider-3', name: 'third', priority: 2, owned: true },
    ];

    expect(providerPriorityWrites(tied, 1, -1)).toEqual([
      { id: 'provider-1', priority: 2, owned: true },
      { id: 'provider-3', priority: 3, owned: true },
    ]);
  });

  it('orders a shared row through the caller own override, not the owners field', () => {
    const mine = { id: 'provider-1', name: 'mine', priority: 1, owned: true };
    const shared = { id: 'provider-2', name: 'shared', priority: 2, owned: false };

    expect(providerPriorityWrites([mine, shared], 1, -1)).toEqual([
      { id: 'provider-2', priority: 1, owned: false },
      { id: 'provider-1', priority: 2, owned: true },
    ]);
  });

  it('writes nothing when a row has no id to address', () => {
    expect(providerPriorityWrites([{ name: 'first', priority: 1 }, second], 0, 1)).toEqual([]);
  });

  it('reaches the same endpoint when one number is typed instead of traded', () => {
    expect(providerPriorityWrite({ id: 'provider-1', owned: true }, 4)).toEqual({ id: 'provider-1', priority: 4, owned: true });
    expect(providerPriorityWrite({ id: 'provider-2', owned: false }, 4)).toEqual({ id: 'provider-2', priority: 4, owned: false });
    expect(providerPriorityWrite({ owned: true }, 4)).toBeUndefined();
  });

  it('reads one field spec by key for the dialog that edits a single value', () => {
    expect(providerField('priority')).toEqual({ key: 'priority', control: 'integer', required: true });
    expect(providerFields(false, false).map((field) => field.key)).toContain(providerField('priority').key);
  });

  it('checks a single-field dialog against only the fields it edits', () => {
    const values = toProviderFormValues();
    expect(firstMissingRequiredField(values)?.key).toBe('model_name');
    expect(firstMissingRequiredField(values, [providerField('priority')])?.key).toBe('priority');

    values.priority = 0;
    expect(firstMissingRequiredField(values, [providerField('priority')])).toBeUndefined();
  });
});
