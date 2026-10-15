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

export interface MockBackend {
  users: MockUser[];
  groups: MockGroup[];
  providers: MockProvider[];
  apiKeys: MockApiKey[];
  sessions: MockSession[];
  userConfig: Record<string, unknown>;
  /** The default agent per session source, held as the agent id the API stores. */
  agentDefaults: Record<string, string>;
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
  userConfig?: Record<string, unknown>;
  /** Seeds the stored default agent per session source, keyed by source. */
  agentDefaults?: Record<string, string>;
  /** Replaces the seeded account list. */
  users?: MockUser[];
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
 * Mocks the auth, user, group, agent, provider, API key and session endpoints in
 * memory. Routes are matched by pathname only: a glob like `**&#47;api&#47;**` would also
 * swallow Vite's own module URLs and break the page load.
 */
export async function mockBackend(page_: Page, options: MockBackendOptions = {}): Promise<MockBackend> {
  const session = options.session ?? boss;
  const state: MockBackend = {
    users: options.users ?? [boss, plain, newComer],
    groups: options.groups ?? [],
    agents: options.agents ?? [],
    providers: options.providers ?? [],
    apiKeys: options.apiKeys ?? [],
    sessions: options.sessions ?? [],
    userConfig: options.userConfig ?? {},
    agentDefaults: options.agentDefaults ?? {},
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
      state.requests.push(`${method} ${path}`);
      if (body !== undefined) {
        state.writes.push({ method, path, body });
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
        return json(route, 200, state.agents);
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
        };
        state.agents.push(created);
        return json(route, 201, created);
      }

      if (path === '/agents/names' && method === 'GET') {
        // Same order the service uses: name then id, so a name two agents share
        // resolves to the same row here as it does in the cloud.
        const names = state.agents
          .map((agent) => ({ id: agent.id, name: agent.name }))
          .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        return json(route, 200, names);
      }

      const agentMatch = /^\/agents\/([^/]+)$/.exec(path);
      if (agentMatch) {
        const agent = state.agents.find((candidate) => candidate.id === agentMatch[1]);
        if (!agent) {
          return json(route, 400, error(400, 'BAD_REQUEST', 'Agent not found.').body);
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
          agent.updated_at = WRITE_TIMESTAMP;
          return json(route, 200, agent);
        }
        if (method === 'DELETE') {
          state.agents = state.agents.filter((candidate) => candidate.id !== agent.id);
          return route.fulfill({ status: 204, body: '' });
        }
      }

      if (path === '/providers' && method === 'GET') {
        // The endpoint is not paginated; it answers with the whole list, lowest
        // priority first.
        const sorted = [...state.providers].sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0));
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
          return json(route, 200, provider);
        }
        if (method === 'DELETE') {
          state.providers = state.providers.filter((candidate) => candidate.id !== provider.id);
          return route.fulfill({ status: 204, body: '' });
        }
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
    localStorage.setItem('authStore', JSON.stringify({ accessToken: token, refreshToken: 'refresh-token' }));
  }, accessToken);
}

export function jwtExpiringIn(seconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: boss.id, iat: now, exp: now + seconds })}.signature`;
}
