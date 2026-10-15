import type { RepositoryAgentName } from '@/api';

/**
 * One entry of the agent listing, as a picker and the default-agent resolution
 * need it. The id is absent when the data cloud answered with names only.
 */
export interface AgentEntry {
  id?: string;
  name: string;
}

/**
 * Reads the agent listing into entries with a name to show.
 *
 * `GET /agents/names` answers with `{ id, name }`, and it answered with bare
 * names before this app started resolving a stored default against it. A data
 * cloud older than that change is still serving the old shape, and reading
 * `entry.name` off a string yields nothing: the picker came up full of nameless
 * options that a user could not choose between, and every one of them submitted
 * an empty agent. Both shapes are read here, so an older cloud degrades to names
 * without ids — the picker keeps working, and only a stored default agent, which
 * is resolved by id, stops being preselected, which is all an older cloud can
 * support.
 *
 * An entry that carries no name to show is dropped rather than rendered blank:
 * the picker is nothing but its names, and a nameless option is unusable.
 */
export function toAgentEntries(entries: readonly (string | RepositoryAgentName)[]): AgentEntry[] {
  const result: AgentEntry[] = [];

  for (const entry of entries) {
    if (typeof entry === 'string') {
      if (entry !== '') {
        result.push({ name: entry });
      }
      continue;
    }
    if (entry && typeof entry.name === 'string' && entry.name !== '') {
      result.push(entry.id === undefined ? { name: entry.name } : { id: entry.id, name: entry.name });
    }
  }

  return result;
}
