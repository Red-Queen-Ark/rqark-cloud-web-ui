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

  it('answers nothing for a listed agent the API left unnamed', () => {
    // The generated type marks both fields optional, so a row that arrives
    // without a name must not become a default the picker cannot match.
    expect(agentNameById([{ id: 'agent-1' }], 'agent-1')).toBe('');
  });
});
