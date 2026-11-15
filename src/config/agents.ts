/**
 * Catalogue of the tools and prompts an agent can be built from.
 *
 * `rqark-data-cloud` stores an agent's `tools` and `prompts` opaquely: it keeps
 * `{name, params}` as JSON and checks neither the names nor the params, and the
 * API has no endpoint that lists them. The engine is therefore the only source
 * of truth, and this file mirrors it by hand.
 *
 * Mirrored from:
 *   - `rqark-core` `src/rqark_core/tools/__init__.py`   (tool classes)
 *   - `rqark-core` `src/rqark_core/prompts/__init__.py` (prompt classes)
 *   - `rqark-app`  `src/rqark_app/config/manager.py`    (the `PROMPTS`/`TOOLS`
 *     registries plus `_build_prompt`/`_build_tool`, which read these entries
 *     back and splat `params` into the matching constructor)
 *
 * Keep this list in step with those registries. A name that is missing here is
 * still preserved on save (see `AgentComponentRef`), so an agent written by a
 * newer engine is not stripped by an older UI.
 *
 * `MemorySave`, `MemorySearch`, `Task`, `MemoryPrompt` and `StatePrompt` are
 * rqark-app's, not the core's: they talk to the data cloud through the `extras`
 * the app hands to a turn, and `MemoryPrompt` and `StatePrompt` stay silent when
 * that connection is missing. They are listed here because an agent still names
 * them like any other entry.
 * `Task` also answers only `list` inside a run started by a task, so a
 * scheduled agent cannot schedule more work. `Todo` reads and writes the
 * user's own todo list, which is not a plan for the current run.
 *
 * Only *constructor* arguments appear as params. The arguments in a tool's
 * `get_openai_schema` (`path`, `pattern`, `command`, …) describe how the model
 * calls the tool at run time and are never part of an agent's configuration.
 *
 * Three entries are thinner than their class suggests:
 *
 *   - `SubAgent` is the only entry with nested params: `prompts` and `tools`,
 *     which `_build_tool` applies recursively.
 *   - `WorkspacePrompt`, `AgentsMdPrompt` and `GitProjectPrompt` each take a
 *     `cwd`, and it is left out on purpose. They expect a `pathlib.Path` while
 *     the config format can only carry strings, so a configured `cwd` reaches
 *     `self.cwd / 'AGENTS.md'` as a `str` and raises. Their `params()` returns
 *     `{}` for the same reason, so such an entry round-trips without it.
 *   - Every remaining leaf param is a string, which is why `AgentParamSpec` has
 *     no type field.
 */

export interface AgentParamSpec {
  /** The constructor keyword, spelled exactly as the engine's parameter is. */
  key: string;
  /** Prefilled when the entry is ticked, for the params the engine defaults. */
  default?: string;
  /** Long free text, such as a character description. */
  multiline?: boolean;
  /** A credential, masked in the form. */
  secret?: boolean;
}

export interface AgentComponentSpec {
  /** PascalCase, spelled exactly as the engine registry spells it. */
  name: string;
  params: AgentParamSpec[];
  /** `SubAgent` carries nested `prompts` and `tools` instead of plain values. */
  nested?: boolean;
}

/**
 * The tool that lets an agent spawn subagents, spelled as the engine registry
 * spells it. It is the one nested tool: the subagents it creates carry their own
 * `prompts` and `tools` under its `params`.
 */
export const SUB_AGENT_TOOL_NAME = 'SubAgent';

/** Order is presentational: grouped the way the engine documents its tools. */
export const AGENT_TOOLS: AgentComponentSpec[] = [
  { name: 'ReadFile', params: [] },
  { name: 'WriteFile', params: [] },
  { name: 'EditFile', params: [] },
  { name: 'ListDir', params: [] },
  { name: 'Grep', params: [] },
  { name: 'ConvertDocument', params: [] },
  { name: 'WebSearch', params: [] },
  { name: 'WebFetch', params: [] },
  { name: 'Exec', params: [] },
  { name: 'PlanUpdate', params: [] },
  { name: 'MemorySave', params: [] },
  { name: 'MemorySearch', params: [] },
  { name: 'Task', params: [] },
  { name: 'Todo', params: [] },
  { name: SUB_AGENT_TOOL_NAME, params: [], nested: true },
  { name: 'Gitea', params: [{ key: 'token', secret: true }, { key: 'base_url' }, { key: 'username' }] },
  { name: 'GitHub', params: [{ key: 'token', secret: true }, { key: 'base_url' }, { key: 'username' }] },
  { name: 'GitLab', params: [{ key: 'token', secret: true }, { key: 'base_url' }, { key: 'username' }] },
];

/** Ordered by the `priority` each class carries, which is the order they compose in. */
export const AGENT_PROMPTS: AgentComponentSpec[] = [
  {
    name: 'RolePrompt',
    params: [
      { key: 'agent_name', default: 'Red Queen Ark' },
      { key: 'user_name', default: 'Sir' },
    ],
  },
  { name: 'AntiSycophancyPrompt', params: [] },
  {
    name: 'CharacterPrompt',
    params: [
      { key: 'identity', multiline: true },
      { key: 'personality', multiline: true },
    ],
  },
  { name: 'SubAgentPrompt', params: [] },
  { name: 'StatePrompt', params: [] },
  { name: 'MemoryPrompt', params: [] },
  { name: 'PlatformPrompt', params: [] },
  { name: 'WorkspacePrompt', params: [] },
  { name: 'AgentsMdPrompt', params: [] },
  { name: 'DateTimePrompt', params: [{ key: 'timezone_name', default: 'Asia/Hong_Kong' }] },
  { name: 'GitProjectPrompt', params: [] },
];

export type AgentComponentKind = 'tools' | 'prompts';

/**
 * One entry of an agent's `prompts` or `tools` list. Structurally identical to
 * the generated `RepositoryAgentPrompt` and `RepositoryAgentTool`, which are
 * interchangeable with each other, so the picker can serve both.
 */
export interface AgentComponentRef {
  name: string;
  /** Absent rather than `{}` when the entry takes no parameters. */
  params?: Record<string, unknown>;
}

export function agentCatalogue(kind: AgentComponentKind): AgentComponentSpec[] {
  return kind === 'tools' ? AGENT_TOOLS : AGENT_PROMPTS;
}

/** The spec for `name`, or `undefined` when the config names something this build does not know. */
export function findAgentComponent(kind: AgentComponentKind, name: string): AgentComponentSpec | undefined {
  return agentCatalogue(kind).find((spec) => spec.name === name);
}

/** A fresh entry for `spec`, with the engine's own defaults filled in. */
export function createAgentComponentRef(spec: AgentComponentSpec): AgentComponentRef {
  const params: Record<string, unknown> = {};

  for (const param of spec.params) {
    if (param.default !== undefined) {
      params[param.key] = param.default;
    }
  }

  if (spec.nested) {
    params.prompts = [];
    params.tools = [];
  }

  return Object.keys(params).length > 0 ? { name: spec.name, params } : { name: spec.name };
}

function isComponentRef(value: unknown): value is AgentComponentRef {
  return typeof value === 'object' && value !== null && typeof (value as AgentComponentRef).name === 'string';
}

/**
 * Drops params an untouched form leaves empty, matching `_without_empty_params`
 * in rqark-app: `params` is omitted rather than written as `{}`, and everything
 * else — including an empty nested list — is kept as the engine keeps it.
 */
export function cleanAgentComponentRef(ref: AgentComponentRef): AgentComponentRef {
  const params: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(ref.params ?? {})) {
    // An empty text input reads back as '', which means "not set".
    if (value === '' || value === undefined || value === null) {
      continue;
    }
    params[key] = Array.isArray(value) ? value.filter(isComponentRef).map(cleanAgentComponentRef) : value;
  }

  return Object.keys(params).length > 0 ? { name: ref.name, params } : { name: ref.name };
}

export function cleanAgentComponents(refs: AgentComponentRef[]): AgentComponentRef[] {
  return refs.map(cleanAgentComponentRef);
}

/**
 * Reads an agent's stored `prompts`/`tools` into picker entries. The generated
 * types mark `name` optional, but an entry with no name cannot be shown in the
 * picker nor removed from it, so such an entry is dropped rather than carried
 * through silently.
 */
export function toAgentComponentRefs(entries: { name?: string; params?: Record<string, unknown> }[] | undefined): AgentComponentRef[] {
  return (entries ?? []).filter((entry): entry is AgentComponentRef => typeof entry.name === 'string' && entry.name !== '');
}

/**
 * Whether an agent can spawn subagents, which is exactly whether its tools carry
 * the subagent tool. The nested `prompts`/`tools` lists are not consulted: they
 * only exist when that tool is already selected.
 */
export function agentHasSubAgent(tools: { name?: string }[] | undefined): boolean {
  return (tools ?? []).some((tool) => tool.name === SUB_AGENT_TOOL_NAME);
}
