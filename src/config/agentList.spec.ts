import { describe, expect, it } from 'vitest';
import { toAgentEntries } from './agentList';

describe('toAgentEntries', () => {
  it('reads the id and name the listing carries', () => {
    expect(toAgentEntries([{ id: 'agent-1', name: 'researcher' }])).toEqual([{ id: 'agent-1', name: 'researcher' }]);
  });

  it('reads a listing of bare names, which is what an older data cloud answers with', () => {
    // Reading `entry.name` off a string yields nothing, which is how the picker
    // came up with nameless options in front of a cloud that predates the ids.
    expect(toAgentEntries(['researcher', 'writer'])).toEqual([{ name: 'researcher' }, { name: 'writer' }]);
  });

  it('keeps the order the cloud answered with', () => {
    expect(
      toAgentEntries([
        { id: 'b', name: 'zeta' },
        { id: 'a', name: 'alpha' },
      ]).map((entry) => entry.name),
    ).toEqual(['zeta', 'alpha']);
  });

  it('keeps two agents that share a name apart when they carry ids', () => {
    // A shared agent may repeat a name the caller already has. They are separate
    // rows, so they stay separate entries.
    expect(
      toAgentEntries([
        { id: 'own', name: 'Angel Holiday' },
        { id: 'shared', name: 'Angel Holiday' },
      ]),
    ).toEqual([
      { id: 'own', name: 'Angel Holiday' },
      { id: 'shared', name: 'Angel Holiday' },
    ]);
  });

  it('drops an entry that carries no name to show', () => {
    expect(toAgentEntries([{ id: 'agent-1' }, { id: 'agent-2', name: '' }, '', { id: 'agent-3', name: 'researcher' }])).toEqual([{ id: 'agent-3', name: 'researcher' }]);
  });
});
