import type { Page, Route } from '@playwright/test';

export interface MockUser {
  id: string;
  username: string;
  email: string;
  display_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  created_at: string;
  /** The last signed-in request. Absent means the account has never been seen. */
  last_seen_at?: string;
}

export interface MockGroup {
  id: string;
  name: string;
  created_at: string;
  memberIds: string[];
}

export interface MockAgentComponent {
  name: string;
  params?: Record<string, unknown>;
}

export interface MockAgent {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at?: string;
  prompts?: MockAgentComponent[];
  tools?: MockAgentComponent[];
  /** Whether another user's agent is shared with everyone. */
  is_public?: boolean;
  /**
   * Whether the caller owns the agent; `false` is how a shared agent is
   * modelled. Absent means the caller owns it, matching the API.
   */
  owned?: boolean;
}

export interface MockProvider {
  id: string;
  name: string;
  created_at: string;
  /** Every other provider field the API accepts is carried through verbatim. */
  [key: string]: unknown;
}

export interface MockApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  /** `user_deleted` or `expired` once the key stopped working, else null. */
  revoked_message: string | null;
  created_at: string;
}

export interface MockSessionMessage {
  seq?: number;
  role?: string;
  /** Kept open, exactly as the API keeps it: the UI must not assume a shape. */
  data?: Record<string, unknown>;
  created_at?: string;
}

export interface MockSession {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  plan_items?: { id: string; content: string; status: string }[];
  /** Served by `/sessions/{uuid}/messages`, in the order they were sent. */
  messages?: MockSessionMessage[];
}

export interface MockTaskRun {
  id: string;
  task_id: string;
  status: string;
  trigger: string;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string;
  session_id: string | null;
}

export interface MockTask {
  id: string;
  name: string;
  prompt: string;
  agent_name: string;
  provider_name: string;
  timezone: string;
  enabled: boolean;
  schedule_kind: string;
  run_at: string | null;
  every_seconds: number | null;
  cron_expr: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MockTodo {
  id: string;
  title: string;
  description: string;
  done: boolean;
  done_at: string | null;
  due_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export const boss: MockUser = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'boss',
  email: 'boss@example.com',
  display_name: 'Boss',
  is_active: true,
  is_staff: true,
  is_superuser: true,
  created_at: '2026-01-02T03:04:05Z',
};

export const plain: MockUser = {
  id: '22222222-2222-4222-8222-222222222222',
  username: 'plain',
  email: 'plain@example.com',
  display_name: 'Plain User',
  is_active: true,
  is_staff: false,
  is_superuser: false,
  created_at: '2026-02-03T04:05:06Z',
};

export const newComer: MockUser = {
  id: '33333333-3333-4333-8333-333333333333',
  username: 'newcomer',
  email: 'newcomer@example.com',
  display_name: 'New Comer',
  is_active: true,
  is_staff: false,
  is_superuser: false,
  created_at: '2026-03-04T05:06:07Z',
};

export interface MockWrite {
  method: string;
  path: string;
  body: unknown;
}

/**
 * The instant the mock stamps a create or an update with. Most seeds share one
 * `created_at`, so a fixed update time keeps "created" and "updated" apart in
 * the list and lets a spec assert on both.
 */
export const WRITE_TIMESTAMP = '2026-05-06T07:08:09Z';

export interface MockProject {
  id: string;
  project_name: string;
  project_path: string;
  created_at: string;
  updated_at?: string;
}

export interface MockSop {
  slug: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

/** One source's default agent, as the account stores it. */
export interface MockAgentDefault {
  source: string;
  agent_id: string;
}

/**
 * One row of an agent's memory log. The list endpoint omits `source_message`, so
 * a row carries it only for the detail endpoint the UI calls when a card is
 * opened.
 */
export interface MockMemory {
  id: string;
  agent_id: string;
  content: string;
  occurred_at: string;
  /** `fact` rows are injected into the prompt, `event` rows are the per-turn log. */
  kind?: 'fact' | 'event';
  keywords?: string[];
  hits?: number;
  pinned?: boolean;
  source?: string;
  source_message?: Record<string, unknown> | null;
}

/**
 * One agent's state board. The board is per (user, agent) pair and is overwritten
 * in full, so there is at most one per agent rather than a log.
 */
export interface MockAgentState {
  agent_id: string;
  content: string;
  version?: number;
  source?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MockUsageLog {
  created_at: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  cached_tokens?: number;
  total_tokens?: number;
  api_key_name?: string | null;
  source?: string;
  user_id?: string;
}

export interface MockBackend {
  users: MockUser[];
  groups: MockGroup[];
  providers: MockProvider[];
  apiKeys: MockApiKey[];
  sessions: MockSession[];
  tasks: MockTask[];
  taskRuns: MockTaskRun[];
  todos: MockTodo[];
  projects: MockProject[];
  userConfig: Record<string, unknown>;
  /** The default agent per session source, held as the agent id the API stores. */
  agentDefaults: Record<string, string>;
  /** Every sop the account holds. */
  sops: MockSop[];
  /** Every memory row the account holds, across all its agents. */
  memories: MockMemory[];
  /** Every agent's state board, at most one per agent. */
  states: MockAgentState[];
  /** Every usage row the account holds. */
  usage: MockUsageLog[];
  requests: string[];
  /** Every request that carried a JSON body, in order. */
  writes: MockWrite[];
}

export interface MockBackendOptions {
  /** The account the stored token belongs to. */
  session?: MockUser;
  loginStatus?: number;
  groups?: MockGroup[];
  /** Replaces the seeded agent list. */
  agents?: MockAgent[];
  /** Replaces the seeded provider list. */
  providers?: MockProvider[];
  /** Replaces the seeded API key list. */
  apiKeys?: MockApiKey[];
  /** Replaces the seeded session list. */
  sessions?: MockSession[];
  /** Replaces the seeded task list. */
  tasks?: MockTask[];
  taskRuns?: MockTaskRun[];
  /**
   * Answers `GET /system/config`, which the login page reads to decide whether
   * to offer the "create one" link. Absent mirrors a deployment with
   * self-registration off, and the link is hidden.
   */
  allowSelfRegistration?: boolean;
  todos?: MockTodo[];
  userConfig?: Record<string, unknown>;
  /** Seeds the stored default agent per session source, keyed by source. */
  agentDefaults?: Record<string, string>;
  /** Replaces the seeded sop list. */
  sops?: MockSop[];
  /** Replaces the seeded memory log. */
  memories?: MockMemory[];
  /** Replaces the seeded state boards. */
  states?: MockAgentState[];
  /** Replaces the seeded project list, which the sidebar tree reads. */
  projects?: MockProject[];
  /** Replaces the seeded account list. */
  users?: MockUser[];
  /** Replaces the seeded usage log. */
  usage?: MockUsageLog[];
}

/** An agent as the caller sees it: owned unless the seed says otherwise. */
function agentView(agent: MockAgent): MockAgent {
  return { owned: true, ...agent };
}

/**
 * The priority a shared provider is served with to a caller that never ordered
 * it. Mirrors the API's `UnsetProviderPriority`.
 */
const UNSET_PROVIDER_PRIORITY = -99;

/**
 * A provider as the caller sees it, so `priority` is always the effective value:
 * the caller's own `priority_override` on a shared provider when it set one, the
 * provider's own priority on a row the caller owns, and `UNSET_PROVIDER_PRIORITY`
 * on a shared row the caller never ordered.
 */
function providerView(provider: MockProvider) {
  const override = provider.priority_override;
  if (provider.owned === false) {
    return { ...provider, priority: override ?? UNSET_PROVIDER_PRIORITY };
  }
  return { owned: true, ...provider };
}

/** Accepts either a map of source to agent id or a list of the same pairs. */
function normalizeAgentDefaults(seed: Record<string, string> | MockAgentDefault[] | undefined): Record<string, string> {
  if (seed === undefined) {
    return {};
  }
  if (Array.isArray(seed)) {
    return Object.fromEntries(seed.map((entry) => [entry.source, entry.agent_id]));
  }
  return { ...seed };
}

/** A stored default agent as the list renders it. */
function agentDefaultView(entry: MockAgentDefault) {
  return { id: `agent-default-${entry.source}`, source: entry.source, agent_id: entry.agent_id, created_at: '2026-04-05T06:07:08Z', updated_at: WRITE_TIMESTAMP };
}

/** The title the API derives from a sop body: its first heading, else the slug. */
function sopTitle(content: string, slug: string): string {
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (line === '') {
      continue;
    }
    return line.startsWith('#') ? line.replace(/^#+/, '').trim() || slug : slug;
  }
  return slug;
}

function page(items: unknown[], limit: number, offset: number, total = items.length) {
  return { items: items.slice(offset, offset + limit), limit, offset, total };
}

function error(status: number, code: string, message: string) {
  return { status, body: { error: { code, message } } };
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * Answers the speech probe the chat input fires before it offers the microphone.
 *
 * The real agent cloud mounts /asr only when SPEECH_ENABLED is on, so an unmocked probe
 * would hide the microphone in every run of a deployment that keeps it off.
 */
export async function mockSpeech(page_: Page, enabled = true): Promise<void> {
  await page_.route(
    (url) => url.pathname === '/agent-api/asr/health',
    (route) => json(route, enabled ? 200 : 404, enabled ? { loaded: true } : { error: { code: 'NOT_FOUND' } }),
  );
}

/**
 * Mocks the auth, user, group, agent, provider, API key and session endpoints in
 * memory. Routes are matched by pathname only: a glob like `**&#47;api&#47;**` would also
 * swallow Vite's own module URLs and break the page load.
 */
export async function mockBackend(page_: Page, options: MockBackendOptions = {}): Promise<MockBackend> {
  const session = options.session ?? boss;
  // Every list is copied, because the write handlers edit a row in place and the
  // specs share their fixtures between tests: a rename or a tick in one test must
  // not be visible to the next.
  const copyRows = <T extends object>(rows: T[] | undefined): T[] => (rows ?? []).map((item) => ({ ...item }));
  const state: MockBackend = {
    users: options.users ? copyRows(options.users) : copyRows([boss, plain, newComer]),
    groups: copyRows(options.groups),
    agents: copyRows(options.agents),
    providers: copyRows(options.providers),
    apiKeys: copyRows(options.apiKeys),
    sessions: copyRows(options.sessions),
    tasks: copyRows(options.tasks),
    taskRuns: copyRows(options.taskRuns),
    todos: copyRows(options.todos),
    userConfig: options.userConfig ?? {},
    agentDefaults: normalizeAgentDefaults(options.agentDefaults),
    sops: copyRows(options.sops),
    memories: copyRows(options.memories),
    states: options.states ?? [],
    usage: options.usage ?? [],
    projects: options.projects ?? [],
    requests: [],
    writes: [],
  };

  let refreshCount = 0;

  await page_.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api/, '');
      const method = route.request().method();
      const body = route.request().postDataJSON?.() as Record<string, unknown> | undefined;
      state.requests.push(`${method} ${path}${url.search}`);
      if (body !== undefined) {
        state.writes.push({ method, path, body });
      }

      if (path === '/system/config' && method === 'GET') {
        return json(route, 200, { allow_self_registration: options.allowSelfRegistration === true });
      }

      if (path === '/auth/login' && method === 'POST') {
        if (options.loginStatus && options.loginStatus !== 200) {
          return json(route, options.loginStatus, { error: { code: 'UNAUTHORIZED', message: 'Invalid username or password.' } });
        }
        return json(route, 200, { access_token: 'access-token', refresh_token: 'refresh-token' });
      }

      if (path === '/auth/refresh' && method === 'POST') {
        refreshCount += 1;
        return json(route, 200, { access_token: `access-token-${refreshCount}`, refresh_token: `refresh-token-${refreshCount}` });
      }

      if (path === '/users/me' && method === 'GET') {
        return json(route, 200, session);
      }

      if (path === '/users/me' && method === 'PATCH') {
        Object.assign(session, body);
        return json(route, 200, session);
      }

      if (path === '/users/me/password' && method === 'PUT') {
        return json(route, 200, { message: 'Password updated.' });
      }

      if (path === '/user-config' && method === 'GET') {
        const entries = Object.entries(state.userConfig).map(([key, value], index) => ({
          id: `config-${index + 1}`,
          key,
          value,
          created_at: '2026-04-05T06:07:08Z',
          updated_at: WRITE_TIMESTAMP,
        }));
        return json(route, 200, entries);
      }

      const userConfigMatch = /^\/user-config\/([^/]+)$/.exec(path);
      if (userConfigMatch) {
        const configKey = decodeURIComponent(userConfigMatch[1]);
        if (method === 'PUT') {
          state.userConfig[configKey] = body?.value;
          return json(route, 200, { id: `config-${configKey}`, key: configKey, value: body?.value, created_at: '2026-04-05T06:07:08Z', updated_at: WRITE_TIMESTAMP });
        }
        if (method === 'DELETE') {
          if (!(configKey in state.userConfig)) {
            return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Config not found.' } });
          }
          state.userConfig = Object.fromEntries(Object.entries(state.userConfig).filter(([key]) => key !== configKey));
          return route.fulfill({ status: 204, body: '' });
        }
      }

      if (path === '/projects' && method === 'GET') {
        return json(route, 200, state.projects);
      }

      // The caller's sops: one page, slug ascending, which is all the chat
      // input reads to fill its slash panel.
      if (path === '/sops' && method === 'GET') {
        const limit = Number(url.searchParams.get('limit') ?? 100);
        const cursor = url.searchParams.get('cursor');
        const rows = [...state.sops].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
        const remaining = cursor ? rows.slice(rows.findIndex((row) => row.slug === cursor) + 1) : rows;
        const items = remaining.slice(0, limit);
        return json(route, 200, { items, next_cursor: remaining.length > limit ? items[items.length - 1].slug : '' });
      }

      if (path === '/sops' && method === 'POST') {
        const slug = String(body?.slug ?? '');
        if (state.sops.some((row) => row.slug === slug)) {
          return json(route, 409, error(409, 'CONFLICT', 'That slug is already taken.').body);
        }
        const content = String(body?.content ?? '');
        const row: MockSop = { slug, title: String(body?.title ?? '') || sopTitle(content, slug), content, created_at: WRITE_TIMESTAMP, updated_at: WRITE_TIMESTAMP };
        state.sops.push(row);
        return json(route, 201, row);
      }

      const sopMatch = /^\/sops\/([^/]+)$/.exec(path);
      if (sopMatch) {
        const slug = decodeURIComponent(sopMatch[1]);
        const row = state.sops.find((candidate) => candidate.slug === slug);
        if (!row) {
          return json(route, 404, error(404, 'NOT_FOUND', 'Sop not found.').body);
        }
        if (method === 'GET') {
          return json(route, 200, row);
        }
        if (method === 'PATCH') {
          if (typeof body?.content === 'string') {
            row.content = body.content;
          }
          if (typeof body?.title === 'string') {
            row.title = body.title;
          }
          row.updated_at = WRITE_TIMESTAMP;
          return json(route, 200, row);
        }
        if (method === 'DELETE') {
          state.sops = state.sops.filter((candidate) => candidate.slug !== slug);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      // One default per source. A source with none answers 404, which is how the
      // real service reports "nothing chosen yet" rather than a failure.
      const agentDefaultMatch = /^\/agent-defaults\/([^/]+)$/.exec(path);
      if (agentDefaultMatch) {
        const source = decodeURIComponent(agentDefaultMatch[1]);
        if (method === 'GET') {
          const agentId = state.agentDefaults[source];
          if (!agentId) {
            return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Agent default not found.' } });
          }
          return json(route, 200, { id: `default-${source}`, source, agent_id: agentId, created_at: '2026-04-05T06:07:08Z', updated_at: WRITE_TIMESTAMP });
        }
        if (method === 'PUT') {
          state.agentDefaults[source] = String(body?.agent_id ?? '');
          return json(route, 200, { id: `default-${source}`, source, agent_id: state.agentDefaults[source], created_at: '2026-04-05T06:07:08Z', updated_at: WRITE_TIMESTAMP });
        }
        if (method === 'DELETE') {
          state.agentDefaults = Object.fromEntries(Object.entries(state.agentDefaults).filter(([key]) => key !== source));
          return route.fulfill({ status: 204, body: '' });
        }
      }

      if (path === '/users' && method === 'GET') {
        const query = url.searchParams.get('q')?.toLowerCase();
        const isActive = url.searchParams.get('is_active');
        let items = state.users;
        if (query) {
          items = items.filter((user) => `${user.username} ${user.email} ${user.display_name}`.toLowerCase().includes(query));
        }
        if (isActive !== null) {
          items = items.filter((user) => String(user.is_active) === isActive);
        }
        return json(route, 200, page(items, Number(url.searchParams.get('limit') ?? 20), Number(url.searchParams.get('offset') ?? 0)));
      }

      if (path === '/users' && method === 'POST') {
        const created: MockUser = {
          id: `user-${state.users.length + 1}`,
          username: String(body?.username ?? ''),
          email: String(body?.email ?? ''),
          display_name: String(body?.display_name ?? ''),
          is_active: true,
          is_staff: false,
          is_superuser: body?.is_superuser === true,
          created_at: '2026-04-05T06:07:08Z',
        };
        state.users.push(created);
        return json(route, 201, created);
      }

      const userMatch = /^\/users\/([^/]+)$/.exec(path);
      if (userMatch) {
        const user = state.users.find((candidate) => candidate.id === userMatch[1]);
        if (!user) {
          return json(route, 400, error(400, 'BAD_REQUEST', 'User not found.').body);
        }
        if (method === 'PATCH') {
          Object.assign(user, body);
          return json(route, 200, user);
        }
        if (method === 'DELETE') {
          user.is_active = false;
          return route.fulfill({ status: 204, body: '' });
        }
      }

      if (/^\/users\/[^/]+\/password$/.test(path) && method === 'PUT') {
        return json(route, 200, { message: 'Password updated.' });
      }

      // Both collections answer with the whole list: neither takes limit or
      // offset. Both are owned by the caller.
      if (path === '/agents' && method === 'GET') {
        return json(route, 200, state.agents.map(agentView));
      }

      if (path === '/agents' && method === 'POST') {
        const created: MockAgent = {
          id: `agent-${state.agents.length + 1}`,
          name: String(body?.name ?? ''),
          description: String(body?.description ?? ''),
          created_at: '2026-04-05T06:07:08Z',
          updated_at: WRITE_TIMESTAMP,
          prompts: (body?.prompts as MockAgentComponent[] | undefined) ?? [],
          tools: (body?.tools as MockAgentComponent[] | undefined) ?? [],
          is_public: body?.is_public === true,
        };
        state.agents.push(created);
        return json(route, 201, agentView(created));
      }

      if (path === '/agents/names' && method === 'GET') {
        // Same order the service uses: name then id, so a name two agents share
        // resolves to the same row here as it does in the cloud.
        const names = state.agents.map((agent) => ({ id: agent.id, name: agent.name })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        return json(route, 200, names);
      }

      const agentMatch = /^\/agents\/([^/]+)$/.exec(path);
      if (agentMatch) {
        const agent = state.agents.find((candidate) => candidate.id === agentMatch[1]);
        if (!agent) {
          return json(route, 404, error(404, 'NOT_FOUND', 'Agent not found.').body);
        }
        if (method === 'GET') {
          return json(route, 200, agentView(agent));
        }
        if (method === 'PUT') {
          // The service treats an absent field as untouched; the UI always sends
          // every field, so a plain assign matches the real partial semantics.
          agent.name = String(body?.name ?? agent.name);
          agent.description = String(body?.description ?? agent.description);
          if (body?.prompts !== undefined) {
            agent.prompts = body.prompts as MockAgentComponent[];
          }
          if (body?.tools !== undefined) {
            agent.tools = body.tools as MockAgentComponent[];
          }
          if (body?.is_public !== undefined) {
            agent.is_public = body.is_public === true;
          }
          agent.updated_at = WRITE_TIMESTAMP;
          return json(route, 200, agentView(agent));
        }
        if (method === 'DELETE') {
          state.agents = state.agents.filter((candidate) => candidate.id !== agent.id);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      if (path === '/todos' && method === 'GET') {
        const filter = url.searchParams.get('done');
        const items = filter === null ? state.todos : state.todos.filter((candidate) => candidate.done === (filter === 'true'));
        return json(route, 200, items);
      }

      if (path === '/todos' && method === 'POST') {
        const created: MockTodo = {
          id: `todo-${state.todos.length + 1}`,
          title: String(body?.title ?? ''),
          description: String(body?.description ?? ''),
          done: false,
          done_at: null,
          due_at: (body?.due_at as string | undefined) ?? null,
          sort_order: Number(body?.sort_order ?? 0),
          created_at: WRITE_TIMESTAMP,
          updated_at: WRITE_TIMESTAMP,
        };
        state.todos.push(created);
        return json(route, 201, created);
      }

      const todoMatch = /^\/todos\/([^/]+)$/.exec(path);
      if (todoMatch) {
        const todo = state.todos.find((candidate) => candidate.id === todoMatch[1]);
        if (!todo) {
          return json(route, 404, error(404, 'NOT_FOUND', 'Todo not found.').body);
        }
        if (method === 'GET') {
          return json(route, 200, todo);
        }
        if (method === 'PUT') {
          if (body?.title !== undefined) {
            todo.title = String(body.title);
          }
          if (body?.description !== undefined) {
            todo.description = String(body.description);
          }
          if (body?.due_at !== undefined) {
            todo.due_at = (body.due_at as string | null) ?? null;
          }
          if (body?.sort_order !== undefined) {
            todo.sort_order = Number(body.sort_order);
          }
          if (body?.done !== undefined) {
            todo.done = body.done === true;
            todo.done_at = todo.done ? WRITE_TIMESTAMP : null;
          }
          todo.updated_at = WRITE_TIMESTAMP;
          return json(route, 200, todo);
        }
        if (method === 'DELETE') {
          state.todos = state.todos.filter((candidate) => candidate.id !== todo.id);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      if (path === '/tasks' && method === 'GET') {
        return json(route, 200, state.tasks);
      }

      if (path === '/tasks' && method === 'POST') {
        const created: MockTask = {
          id: `task-${state.tasks.length + 1}`,
          name: String(body?.name ?? ''),
          prompt: String(body?.prompt ?? ''),
          agent_name: String(body?.agent_name ?? ''),
          provider_name: String(body?.provider_name ?? ''),
          timezone: String(body?.timezone ?? 'UTC'),
          enabled: body?.enabled !== false,
          schedule_kind: String(body?.schedule_kind ?? 'cron'),
          run_at: (body?.run_at as string | undefined) ?? null,
          every_seconds: (body?.every_seconds as number | undefined) ?? null,
          cron_expr: (body?.cron_expr as string | undefined) ?? null,
          next_run_at: body?.enabled === false ? null : WRITE_TIMESTAMP,
          created_at: WRITE_TIMESTAMP,
          updated_at: WRITE_TIMESTAMP,
        };
        state.tasks.push(created);
        return json(route, 201, created);
      }

      const taskRunsMatch = /^\/tasks\/([^/]+)\/runs$/.exec(path);
      if (taskRunsMatch) {
        const task = state.tasks.find((candidate) => candidate.id === taskRunsMatch[1]);
        if (!task) {
          return json(route, 404, error(404, 'NOT_FOUND', 'Task not found.').body);
        }
        // Newest scheduled instant first, the same order the service answers in.
        const all = state.taskRuns.filter((run) => run.task_id === task.id).sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
        return json(route, 200, page(all, Number(url.searchParams.get('limit') ?? 20), Number(url.searchParams.get('offset') ?? 0)));
      }

      const taskMatch = /^\/tasks\/([^/]+)$/.exec(path);
      if (taskMatch) {
        const task = state.tasks.find((candidate) => candidate.id === taskMatch[1]);
        if (!task) {
          return json(route, 404, error(404, 'NOT_FOUND', 'Task not found.').body);
        }
        if (method === 'GET') {
          return json(route, 200, task);
        }
        if (method === 'PUT') {
          Object.assign(task, body);
          task.enabled = task.enabled !== false;
          task.next_run_at = task.enabled ? WRITE_TIMESTAMP : null;
          task.updated_at = WRITE_TIMESTAMP;
          return json(route, 200, task);
        }
        if (method === 'DELETE') {
          state.tasks = state.tasks.filter((candidate) => candidate.id !== task.id);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      // The caller's default agent per source. The whole set is answered at
      // once, ordered by source; the source is the key a write upserts on.
      if (path === '/agent-defaults' && method === 'GET') {
        const entries = Object.entries(state.agentDefaults).map(([source, agentId]) => ({ source, agent_id: agentId }));
        return json(route, 200, entries.sort((a, b) => a.source.localeCompare(b.source)).map(agentDefaultView));
      }

      if (path === '/providers' && method === 'GET') {
        // The endpoint is not paginated; it answers with the whole list, ordered
        // by the priority that applies to the caller.
        const sorted = state.providers.map(providerView).sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0));
        return json(route, 200, sorted);
      }

      if (path === '/providers' && method === 'POST') {
        const created: MockProvider = { id: `provider-${state.providers.length + 1}`, name: '', created_at: '2026-04-05T06:07:08Z', updated_at: WRITE_TIMESTAMP };
        Object.assign(created, body);
        state.providers.push(created);
        return json(route, 201, created);
      }

      if (path === '/providers/models' && method === 'GET') {
        return json(
          route,
          200,
          state.providers.map((provider) => ({ name: provider.name, model_name: provider.model_name })),
        );
      }

      const providerMatch = /^\/providers\/([^/]+)$/.exec(path);
      if (providerMatch) {
        const provider = state.providers.find((candidate) => candidate.id === providerMatch[1]);
        if (!provider) {
          return json(route, 400, error(400, 'BAD_REQUEST', 'Provider not found.').body);
        }
        if (method === 'PUT') {
          // The service treats an absent field as untouched; the UI omits empty
          // controls, so an assign matches the real partial semantics.
          Object.assign(provider, body);
          provider.updated_at = WRITE_TIMESTAMP;
          return json(route, 200, providerView(provider));
        }
        if (method === 'DELETE') {
          state.providers = state.providers.filter((candidate) => candidate.id !== provider.id);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      const providerPriorityMatch = /^\/providers\/([^/]+)\/priority$/.exec(path);
      if (providerPriorityMatch && method === 'PUT') {
        const provider = state.providers.find((candidate) => candidate.id === providerPriorityMatch[1]);
        if (!provider) {
          return json(route, 400, error(400, 'BAD_REQUEST', 'Provider not found.').body);
        }
        provider.priority_override = Number(body?.priority ?? 0);
        return json(route, 200, providerView(provider));
      }

      if (path === '/usage' && method === 'POST') {
        const from = body?.from as string | undefined;
        const to = body?.to as string | undefined;
        const apiKeyName = body?.api_key_name as string | undefined;
        const sourceQuery = body?.source as string | undefined;
        const userIdQuery = body?.user_id as string | undefined;
        const scopedUser = session.is_superuser ? userIdQuery : session.id;
        const rows = state.usage
          .filter((row) => (scopedUser ? row.user_id === undefined || row.user_id === scopedUser : true))
          .filter((row) => (apiKeyName ? row.api_key_name === apiKeyName : true))
          .filter((row) => (sourceQuery ? row.source === sourceQuery : true))
          .filter((row) => (from ? row.created_at >= from : true))
          .filter((row) => (to ? row.created_at < to : true))
          .sort((left, right) => right.created_at.localeCompare(left.created_at));
        return json(route, 200, rows);
      }

      if (path === '/api-keys' && method === 'GET') {
        // The endpoint hides the keys their owner deleted; a key that merely
        // expired stays in the list.
        const visible = state.apiKeys.filter((key) => key.revoked_message !== 'user_deleted');
        return json(route, 200, page(visible, Number(url.searchParams.get('limit') ?? 20), Number(url.searchParams.get('offset') ?? 0)));
      }

      if (path === '/api-keys' && method === 'POST') {
        const key = `rqark-${String(state.apiKeys.length + 1)}000000000000000000000000000000000000`;
        const created: MockApiKey = {
          id: `api-key-${state.apiKeys.length + 1}`,
          name: String(body?.name ?? ''),
          key_prefix: key.slice(0, 12),
          is_active: true,
          expires_at: (body?.expires_at as string | undefined) ?? null,
          last_used_at: null,
          revoked_at: null,
          revoked_message: null,
          created_at: '2026-04-05T06:07:08Z',
        };
        state.apiKeys.push(created);
        return json(route, 201, { ...created, key });
      }

      const apiKeyMatch = /^\/api-keys\/([^/]+)$/.exec(path);
      if (apiKeyMatch) {
        const key = state.apiKeys.find((candidate) => candidate.id === apiKeyMatch[1]);
        if (!key) {
          return json(route, 400, error(400, 'NOT_FOUND', 'API key not found.').body);
        }

        if (method === 'PATCH') {
          if (body?.name !== undefined) {
            key.name = String(body.name);
          }
          if (body && 'expires_at' in body) {
            // Setting an expiry is also how a lapsed key is renewed: the
            // service clears the revocation and switches the key back on.
            if (key.revoked_message === 'expired') {
              key.revoked_at = null;
              key.revoked_message = null;
              key.is_active = true;
            }
            key.expires_at = (body.expires_at as string | null) ?? null;
          }
          if (body?.is_active !== undefined) {
            if (body.is_active === true && key.revoked_at !== null) {
              return json(route, 409, error(409, 'CONFLICT', 'This API key has expired. Set expires_at to a future time to renew it.').body);
            }
            key.is_active = body.is_active === true;
          }
          return json(route, 200, key);
        }

        if (method === 'DELETE') {
          key.is_active = false;
          key.revoked_at = '2026-04-06T07:08:09Z';
          key.revoked_message = 'user_deleted';
          return route.fulfill({ status: 204, body: '' });
        }
      }

      // An agent's memory log, paged by keyset on (occurred_at, id) descending.
      // The list omits `source_message`; only the detail route carries it.
      if (path === '/memory' && method === 'GET') {
        const agentId = url.searchParams.get('agent_id');
        const limit = Number(url.searchParams.get('limit') ?? 100);
        const cursor = url.searchParams.get('cursor');
        const rows = state.memories.filter((row) => agentId === null || row.agent_id === agentId).sort((a, b) => (a.occurred_at === b.occurred_at ? (a.id < b.id ? 1 : -1) : a.occurred_at < b.occurred_at ? 1 : -1));
        const remaining = cursor ? rows.slice(rows.findIndex((row) => row.id === cursor) + 1) : rows;
        const items = remaining.slice(0, limit).map((row) => ({ ...row, source_message: undefined }));
        return json(route, 200, { items, next_cursor: remaining.length > limit ? items[items.length - 1].id : '' });
      }

      // One agent's state board. A pair that has never been written answers 404
      // rather than an empty board, which the page reads as "no state yet".
      if (path === '/memory/state' && method === 'GET') {
        const agentId = url.searchParams.get('agent_id') ?? '';
        const agent = state.agents.find((candidate) => candidate.id === agentId);
        const board = state.states.find((candidate) => candidate.agent_id === agentId);
        if (!agent || !board) {
          return json(route, 404, error(404, 'NOT_FOUND', 'State not found.').body);
        }
        return json(route, 200, board);
      }

      if (path === '/memory/state' && method === 'PUT') {
        const agentId = String(body?.agent_id ?? '');
        const agent = state.agents.find((candidate) => candidate.id === agentId);
        if (!agent) {
          return json(route, 404, error(404, 'NOT_FOUND', 'Agent not found.').body);
        }
        const content = String(body?.content ?? '');
        if (content.trim() === '' || [...content].length > 2000) {
          return json(route, 400, error(400, 'INVALID_CONTENT', 'content is required.').body);
        }
        const existing = state.states.find((candidate) => candidate.agent_id === agentId);
        if (existing && body?.version !== undefined && body.version !== existing.version) {
          return json(route, 409, error(409, 'STATE_CONFLICT', 'The state changed.').body);
        }
        const written: MockAgentState = {
          agent_id: agentId,
          content,
          version: (existing?.version ?? 0) + 1,
          source: String(body?.source ?? ''),
          created_at: existing?.created_at ?? WRITE_TIMESTAMP,
          updated_at: WRITE_TIMESTAMP,
        };
        state.states = [...state.states.filter((candidate) => candidate.agent_id !== agentId), written];
        return json(route, 200, written);
      }

      if (path === '/memory/state' && method === 'DELETE') {
        const agentId = url.searchParams.get('agent_id') ?? '';
        if (!state.states.some((candidate) => candidate.agent_id === agentId)) {
          return json(route, 404, error(404, 'NOT_FOUND', 'State not found.').body);
        }
        state.states = state.states.filter((candidate) => candidate.agent_id !== agentId);
        return route.fulfill({ status: 204, body: '' });
      }

      const memoryMatch = /^\/memory\/([^/]+)$/.exec(path);
      if (memoryMatch) {
        const row = state.memories.find((candidate) => candidate.id === memoryMatch[1]);
        if (!row) {
          return json(route, 404, error(404, 'NOT_FOUND', 'Memory not found.').body);
        }
        if (method === 'GET') {
          return json(route, 200, row);
        }
        if (method === 'PATCH') {
          // pinned is the only field a caller may change.
          row.pinned = body?.pinned === true;
          return json(route, 200, row);
        }
        if (method === 'DELETE') {
          state.memories = state.memories.filter((candidate) => candidate.id !== row.id);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      // A session belongs to the caller and is listed whole: like the agents
      // and providers endpoints it takes no limit or offset.
      if (path === '/sessions' && method === 'GET') {
        return json(route, 200, state.sessions);
      }

      if (path === '/sessions' && method === 'POST') {
        const created: MockSession = {
          id: String(body?.uuid ?? `session-${state.sessions.length + 1}`),
          title: String(body?.title ?? ''),
          created_at: '2026-04-05T06:07:08Z',
          updated_at: WRITE_TIMESTAMP,
          plan_items: (body?.plan_items as MockSession['plan_items']) ?? [],
        };
        state.sessions.push(created);
        return json(route, 201, created);
      }

      const sessionMessagesMatch = /^\/sessions\/([^/]+)\/messages$/.exec(path);
      if (sessionMessagesMatch && method === 'GET') {
        const session = state.sessions.find((candidate) => candidate.id === sessionMessagesMatch[1]);
        if (!session) {
          return json(route, 404, error(404, 'NOT_FOUND', 'Session not found.').body);
        }
        return json(route, 200, session.messages ?? []);
      }

      const sessionMatch = /^\/sessions\/([^/]+)$/.exec(path);
      if (sessionMatch) {
        const session = state.sessions.find((candidate) => candidate.id === sessionMatch[1]);
        if (!session) {
          return json(route, 404, error(404, 'NOT_FOUND', 'Session not found.').body);
        }
        if (method === 'GET') {
          return json(route, 200, session);
        }
        if (method === 'PUT') {
          if (body?.title !== undefined) {
            session.title = String(body.title);
          }
          if (body?.source !== undefined) {
            session.source = String(body.source);
          }
          if (body?.plan_items !== undefined) {
            session.plan_items = body.plan_items as MockSession['plan_items'];
          }
          session.updated_at = WRITE_TIMESTAMP;
          return json(route, 200, session);
        }
        if (method === 'DELETE') {
          state.sessions = state.sessions.filter((candidate) => candidate.id !== session.id);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      if (path === '/groups' && method === 'GET') {
        return json(
          route,
          200,
          page(
            state.groups.map((group) => ({ id: group.id, name: group.name, created_at: group.created_at })),
            Number(url.searchParams.get('limit') ?? 20),
            Number(url.searchParams.get('offset') ?? 0),
          ),
        );
      }

      if (path === '/groups' && method === 'POST') {
        const created: MockGroup = {
          id: `group-${state.groups.length + 1}`,
          name: String(body?.name ?? ''),
          created_at: '2026-04-05T06:07:08Z',
          memberIds: [],
        };
        state.groups.push(created);
        return json(route, 201, { id: created.id, name: created.name, created_at: created.created_at });
      }

      const groupMatch = /^\/groups\/([^/]+)$/.exec(path);
      if (groupMatch) {
        const group = state.groups.find((candidate) => candidate.id === groupMatch[1]);
        if (!group) {
          return json(route, 400, error(400, 'BAD_REQUEST', 'Group not found.').body);
        }
        if (method === 'PATCH') {
          group.name = String(body?.name ?? group.name);
          return json(route, 200, { id: group.id, name: group.name, created_at: group.created_at });
        }
        if (method === 'DELETE') {
          state.groups = state.groups.filter((candidate) => candidate.id !== group.id);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      const membersMatch = /^\/groups\/([^/]+)\/users$/.exec(path);
      if (membersMatch && method === 'GET') {
        const group = state.groups.find((candidate) => candidate.id === membersMatch[1]);
        const items = state.users.filter((user) => group?.memberIds.includes(user.id));
        return json(route, 200, page(items, 100, 0));
      }

      const memberMatch = /^\/groups\/([^/]+)\/users\/([^/]+)$/.exec(path);
      if (memberMatch) {
        const group = state.groups.find((candidate) => candidate.id === memberMatch[1]);
        if (!group) {
          return json(route, 400, error(400, 'BAD_REQUEST', 'Group not found.').body);
        }
        if (method === 'PUT') {
          if (!group.memberIds.includes(memberMatch[2])) {
            group.memberIds.push(memberMatch[2]);
          }
          return route.fulfill({ status: 204, body: '' });
        }
        if (method === 'DELETE') {
          group.memberIds = group.memberIds.filter((id) => id !== memberMatch[2]);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      return json(route, 404, error(404, 'BAD_REQUEST', `Unmocked ${method} ${path}`).body);
    },
  );

  return state;
}

/** Seeds a stored session so a test can start on an authenticated page. */
export async function seedSession(page_: Page): Promise<void> {
  const accessToken = jwtExpiringIn(-60);
  await page_.addInitScript((token: string) => {
    localStorage.setItem('rqark.auth.tokens', JSON.stringify({ accessToken: token, refreshToken: 'refresh-token' }));
  }, accessToken);
}

export function jwtExpiringIn(seconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: boss.id, iat: now, exp: now + seconds })}.signature`;
}
