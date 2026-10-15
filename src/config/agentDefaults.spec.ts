import { describe, expect, it } from 'vitest';
import { agentNameById } from './agentDefaults';

describe('agentNameById', () => {
  it('answers the name of the agent the id names', () => {
    const agents = [
      { id: 'agent-1', name: 'researcher' },
      { id: 'agent-2', name: 'writer' },
    ];

    expect(agentNameById(agents, 'agent-2')).toBe('writer');
  });

  it('answers nothing for a source with no default', () => {
    expect(agentNameById([{ id: 'agent-1', name: 'researcher' }], undefined)).toBe('');
  });

  it('answers nothing for an id the listing no longer holds', () => {
    expect(agentNameById([{ id: 'agent-1', name: 'researcher' }], 'agent-gone')).toBe('');
  });

  it('answers nothing for a listing that carries no ids', () => {
    // A data cloud that answers with names only cannot resolve a stored default,
    // which is stored by id. Without this the first such entry would match the
    // absent id and be read as the default the user chose.
    expect(agentNameById([{ name: 'researcher' }, { name: 'writer' }], 'agent-1')).toBe('');
    expect(agentNameById([{ name: 'researcher' }], undefined)).toBe('');
  });
});
