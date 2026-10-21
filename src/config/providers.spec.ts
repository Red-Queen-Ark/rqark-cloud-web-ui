import { describe, expect, it } from 'vitest';
import { PROVIDER_FIELDS, firstMissingRequiredField, providerDisplayName, providerFields, providerPriorityWrites, sortProvidersByPriority, toProviderFormValues, toProviderRequestBody } from './providers';

describe('provider form', () => {
  it('marks exactly the fields validateNewProvider requires', () => {
    // rqark-data-cloud rejects a create without these four; `name` is optional
    // and falls back to model_name.
    expect(PROVIDER_FIELDS.filter((field) => field.required).map((field) => field.key)).toEqual(['model_name', 'api_base', 'api_key', 'priority']);
  });

  it('shows the required fields up front and hides the rest behind the disclosure', () => {
    // The two halves partition the form: nothing optional escapes the
    // disclosure except `name`, which stays up front because it labels the
    // provider; and nothing required is ever buried in it.
    expect(providerFields(false).map((field) => field.key)).toEqual(['name', 'model_name', 'api_base', 'api_key', 'priority']);
    expect(providerFields(true).map((field) => field.key)).toEqual(['temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'seed', 'reasoning_effort', 'thinking', 'combine']);
    expect([...providerFields(false), ...providerFields(true)]).toEqual(PROVIDER_FIELDS);
    expect(providerFields(true).every((field) => field.required !== true)).toBe(true);
    // `name` is the only visible field the API does not insist on.
    expect(
      providerFields(false)
        .filter((field) => field.required !== true)
        .map((field) => field.key),
    ).toEqual(['name']);
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
    // A value the provider carries wins over the form default.
    expect(values.reasoning_effort).toBe('low');
    // The two switches hold booleans; only the request body spells them out.
    expect(values.thinking).toBe(true);
    expect(values.combine).toBe(true);
    // `api_key` is write-only: the DTO never carries it, so the control is blank
    // whatever key the provider stores.
    expect(values.api_key).toBe('');
  });

  it('leaves the values a provider does not carry blank, save for the defaulted select', () => {
    const values = toProviderFormValues({ id: 'provider-1', model_name: 'kimi-k3' });

    expect(values.temperature).toBe('');
    // The select has no empty option, so it falls back to its default instead.
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
    });
  });

  it('treats a blank required field as missing, but not a priority of zero', () => {
    const blank = toProviderFormValues();
    expect(firstMissingRequiredField(blank)?.key).toBe('model_name');

    const zero = toProviderFormValues({ model_name: 'kimi-k3', api_base: 'https://api.moonshot.cn/v1', priority: 0 });
    // A create has to name the key; an edit cannot, so the same form passes.
    expect(firstMissingRequiredField(zero)?.key).toBe('api_key');
    zero.api_key = 'sk-x';
    expect(firstMissingRequiredField(zero)).toBeUndefined();
    expect(firstMissingRequiredField(zero, PROVIDER_FIELDS, false)).toBeUndefined();
  });

  it('stops requiring the write-only key once the dialog edits a provider', () => {
    const editing = toProviderFormValues({ model_name: 'kimi-k3', api_base: 'https://api.moonshot.cn/v1', priority: 1 });

    // The control is still rendered — a caller may rotate the key — but on an
    // edit it reads back blank and is no longer flagged as required.
    const key = providerFields(false, false).find((field) => field.key === 'api_key');
    expect(key?.writeOnly).toBe(true);
    expect(key?.required).not.toBe(true);
    expect(providerFields(false, true).find((field) => field.key === 'api_key')?.required).toBe(true);
    // A blank key stays out of the body, which the API reads as "keep it".
    expect(toProviderRequestBody(editing).api_key).toBeUndefined();
  });

  it('falls back to model_name when a provider has no name', () => {
    expect(providerDisplayName({ name: '', model_name: 'kimi-k3' })).toBe('kimi-k3');
    expect(providerDisplayName({ name: 'primary', model_name: 'kimi-k3' })).toBe('primary');
  });
});

describe('provider priority order', () => {
  const first = { id: 'provider-1', name: 'first', priority: 1 };
  const second = { id: 'provider-2', name: 'second', priority: 2 };
  const third = { id: 'provider-3', name: 'third', priority: 3 };

  it('sorts lowest priority first and treats a missing one as zero', () => {
    const order = sortProvidersByPriority([third, first, { id: 'provider-0', name: 'unset' }, second]);
    expect(order.map((provider) => provider.id)).toEqual(['provider-0', 'provider-1', 'provider-2', 'provider-3']);
  });

  it('swaps the two priorities when a row trades places with its neighbour', () => {
    expect(providerPriorityWrites([first, second, third], 2, -1)).toEqual([
      { id: 'provider-3', priority: 2 },
      { id: 'provider-2', priority: 3 },
    ]);
    expect(providerPriorityWrites([first, second, third], 0, 1)).toEqual([
      { id: 'provider-1', priority: 2 },
      { id: 'provider-2', priority: 1 },
    ]);
  });

  it('has nothing to write at either end of the list', () => {
    expect(providerPriorityWrites([first, second, third], 0, -1)).toEqual([]);
    expect(providerPriorityWrites([first, second, third], 2, 1)).toEqual([]);
  });

  it('renumbers when the neighbours share a priority, so the move still happens', () => {
    // A swap between equal values would change nothing, so the whole list is
    // renumbered 1..n in the swapped order instead.
    const tied = [
      { id: 'provider-1', name: 'first', priority: 1 },
      { id: 'provider-2', name: 'second', priority: 1 },
      { id: 'provider-3', name: 'third', priority: 2 },
    ];

    expect(providerPriorityWrites(tied, 1, -1)).toEqual([
      { id: 'provider-1', priority: 2 },
      { id: 'provider-3', priority: 3 },
    ]);
  });

  it('writes nothing when a row has no id to address', () => {
    expect(providerPriorityWrites([{ name: 'first', priority: 1 }, second], 0, 1)).toEqual([]);
  });
});
