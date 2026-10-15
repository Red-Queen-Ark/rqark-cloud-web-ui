import type { AgentEntry } from '@/config/agentList';

/**
 * The name a stored default agent is shown as.
 *
 * `rqark-data-cloud` stores one default per session source, and it stores it by
 * id, while everything a turn carries — and everything the picker shows — is a
 * name: the chat socket resolves the agent by name on the engine side. A default
 * therefore has to be resolved before it can be used, and the listing it resolves
 * against is the same id/name pairs `GET /agents/names` answers with.
 *
 * The id is what does the resolving. Agent names are unique per owner only, so a
 * caller that sees a shared agent can hold two agents under one name; picking by
 * id keeps the drawn default on the row the user actually chose. An id that is
 * not in the listing — an agent deleted since, a shared one its owner stopped
 * sharing, or a data cloud that answered with names only — resolves to nothing,
 * and the caller falls back to its own default.
 */
export function agentNameById(agents: AgentEntry[], id: string | undefined): string {
  // A source with no default answers without an id, which must not be matched
  // against the entries that carry none either: that pair would make the first
  // of them look like the default the user chose.
  if (!id) {
    return '';
  }
  const name = agents.find((agent) => agent.id === id)?.name;
  return typeof name === 'string' ? name : '';
}
