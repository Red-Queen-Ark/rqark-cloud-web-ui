import type { RepositoryAgentName } from '@/api';

/**
 * The name a stored default agent is shown as.
 *
 * `rqark-data-cloud` stores one default per session source, and it stores it by
 * id, while everything a turn carries — and everything the picker shows — is a
 * name: the chat socket resolves the agent by name on the engine side. A default
 * therefore has to be resolved before it can be used, and the listing it
 * resolves against is the same id/name pairs `GET /agents/names` answers with.
 *
 * The id is what does the resolving. Agent names are unique per owner only, so a
 * caller that sees a shared agent can hold two agents under one name; picking by
 * id keeps the drawn default on the row the user actually chose. An id that is
 * not in the listing — an agent deleted since, or a shared one its owner stopped
 * sharing — resolves to nothing, and the caller falls back to its own default.
 */
export function agentNameById(agents: RepositoryAgentName[], id: string | undefined): string {
  const name = agents.find((agent) => agent.id === id)?.name;
  return typeof name === 'string' ? name : '';
}
