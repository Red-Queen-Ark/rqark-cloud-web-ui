import { describe, expect, it } from 'vitest';
import { SUB_AGENT_TOOL_NAME, agentHasSubAgent } from './agents';

describe('agent subagent detection', () => {
  it('is true only when the tools carry the subagent tool', () => {
    expect(agentHasSubAgent([{ name: 'ReadFile' }, { name: SUB_AGENT_TOOL_NAME }])).toBe(true);
    expect(agentHasSubAgent([{ name: 'ReadFile' }])).toBe(false);
    expect(agentHasSubAgent([])).toBe(false);
    expect(agentHasSubAgent(undefined)).toBe(false);
  });

  it('does not mistake the subagent prompt for the subagent tool', () => {
    // `SubAgentPrompt` only tells the model how to behave as a subagent; it is
    // `SubAgent` that lets an agent spawn one, and only that is the marker.
    expect(agentHasSubAgent([{ name: 'SubAgentPrompt' }])).toBe(false);
  });
});
